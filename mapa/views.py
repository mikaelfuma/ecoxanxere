import json
from functools import wraps

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.core.cache import cache
from django.core.mail import send_mail
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils.safestring import mark_safe
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .forms import PontoForm, SugestaoForm
from .models import Ponto, Relato

TIPOS_VALIDOS = {t for t, _ in Ponto.TIPOS}
STATUS_VALIDOS = {s for s, _ in Ponto.STATUS}
MAX_TENTATIVAS = 5
BLOQUEIO_SEG = 15 * 60


def serializar(p, admin=False):
    d = {
        "id": p.id,
        "nome": p.nome,
        "bairro": p.bairro,
        "tipo": p.tipo,
        "lat": p.lat,
        "lng": p.lng,
        "horario": p.horario,
        "telefone": p.telefone,
        "aceita": p.aceita,
        "verificado_em": p.verificado_em.isoformat() if p.verificado_em else None,
        "imagem": p.imagem.url if p.imagem else None,
    }
    if admin:
        d["status"] = p.status
    return d


def staff_required(view):
    @wraps(view)
    def inner(request, *args, **kwargs):
        if not (request.user.is_authenticated and request.user.is_staff):
            return JsonResponse({"erro": "Acesso restrito à administração."}, status=403)
        return view(request, *args, **kwargs)
    return inner


@ensure_csrf_cookie
def index(request):
    return render(request, "mapa/index.html")


# ---------- público ----------

@require_GET
def api_pontos(request):
    pontos = Ponto.objects.filter(status="aprovado")
    return JsonResponse([serializar(p) for p in pontos], safe=False)


@require_POST
def api_sugerir(request):
    # campo-armadilha: humanos não veem/preenchem; robôs sim. Finge sucesso e descarta.
    if request.POST.get("website"):
        return JsonResponse({"ok": True}, status=201)
    if limite_excedido(request, "sugestao", 5, 60 * 60):
        return JsonResponse({"erro": "Muitas sugestões em pouco tempo. Tente mais tarde."}, status=429)

    form = SugestaoForm(request.POST, request.FILES)
    if not form.is_valid():
        return JsonResponse({"erro": "Dados inválidos."}, status=400)
    ponto = form.save(commit=False)
    ponto.nome = ponto.nome.strip()[:120]
    ponto.bairro = (ponto.bairro or "Xanxerê").strip()[:80]
    ponto.status = "pendente"
    ponto.save()
    avisar("EcoXanxerê: nova sugestão de ponto",
           f"{ponto.nome} ({ponto.get_tipo_display()}), {ponto.bairro}.\nAprove ou rejeite no site, em Área da administração.")
    return JsonResponse({"ok": True}, status=201)


@require_POST
def api_reportar(request):
    try:
        d = json.loads(request.body)
    except (ValueError, TypeError):
        return JsonResponse({"erro": "Dados inválidos."}, status=400)
    if d.get("website"):
        return JsonResponse({"ok": True}, status=201)
    if limite_excedido(request, "relato", 10, 60 * 60):
        return JsonResponse({"erro": "Muitos relatos em pouco tempo. Tente mais tarde."}, status=429)

    motivos = {m for m, _ in Relato.MOTIVOS}
    motivo = d.get("motivo")
    ponto = Ponto.objects.filter(pk=d.get("ponto"), status="aprovado").first()
    if not ponto or motivo not in motivos:
        return JsonResponse({"erro": "Dados inválidos."}, status=400)
    detalhe = str(d.get("detalhe") or "").strip()[:300]
    r = Relato.objects.create(ponto=ponto, motivo=motivo, detalhe=detalhe)
    avisar("EcoXanxerê: problema reportado em um ponto",
           f"{ponto.nome}: {r.get_motivo_display()}\n{detalhe}")
    return JsonResponse({"ok": True}, status=201)


# ---------- sessão ----------

def _ip(request):
    if settings.CONFIAR_PROXY:
        enc = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if enc:
            return enc.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "?")


def limite_excedido(request, nome, maximo, janela_seg):
    """True se este IP já passou do limite de ações 'nome' na janela de tempo."""
    chave = f"rl_{nome}_{_ip(request)}"
    cache.add(chave, 0, janela_seg)
    try:
        return cache.incr(chave) > maximo
    except ValueError:
        cache.set(chave, 1, janela_seg)
        return False


def avisar(assunto, corpo):
    if settings.EMAIL_AVISO:
        send_mail(assunto, corpo, settings.DEFAULT_FROM_EMAIL, [settings.EMAIL_AVISO], fail_silently=True)


@require_GET
def api_me(request):
    return JsonResponse({"admin": bool(request.user.is_authenticated and request.user.is_staff)})


@require_POST
def api_login(request):
    chave = f"login_falhas_{_ip(request)}"
    if cache.get(chave, 0) >= MAX_TENTATIVAS:
        return JsonResponse({"erro": "Muitas tentativas. Aguarde 15 minutos."}, status=429)
    try:
        d = json.loads(request.body)
        usuario, senha = str(d["usuario"]), str(d["senha"])
    except (ValueError, KeyError, TypeError):
        return JsonResponse({"erro": "Dados inválidos."}, status=400)

    user = authenticate(request, username=usuario, password=senha)
    if user is None or not user.is_staff:
        cache.set(chave, cache.get(chave, 0) + 1, BLOQUEIO_SEG)
        return JsonResponse({"erro": "Usuário ou senha incorretos."}, status=401)

    cache.delete(chave)
    login(request, user)
    return JsonResponse({"ok": True})


@require_POST
def api_logout(request):
    logout(request)
    return JsonResponse({"ok": True})


# ---------- administração (só staff) ----------

@require_GET
@staff_required
def api_admin_pontos(request):
    return JsonResponse([serializar(p, admin=True) for p in Ponto.objects.all()], safe=False)


@require_POST
@staff_required
def api_admin_salvar(request):
    """Cria (sem id) ou edita (com id). Recebe multipart/form-data."""
    pk = request.POST.get("id")
    instancia = get_object_or_404(Ponto, pk=pk) if pk else None
    dados = request.POST.copy()
    if not dados.get("status"):
        dados["status"] = "aprovado"

    form = PontoForm(dados, request.FILES, instance=instancia)
    if not form.is_valid():
        erros = "; ".join(f"{c}: {' '.join(e)}" for c, e in form.errors.items())
        return JsonResponse({"erro": erros}, status=400)

    ponto = form.save(commit=False)
    if request.POST.get("remover_imagem") == "1" and "imagem" not in request.FILES:
        if ponto.imagem:
            ponto.imagem.delete(save=False)
        ponto.imagem = None
    ponto.save()
    return JsonResponse(serializar(ponto, admin=True), status=200 if pk else 201)


@require_POST
@staff_required
def api_admin_status(request, pk):
    try:
        status = json.loads(request.body)["status"]
    except (ValueError, KeyError, TypeError):
        return JsonResponse({"erro": "Dados inválidos."}, status=400)
    if status not in STATUS_VALIDOS:
        return JsonResponse({"erro": "Status inválido."}, status=400)
    ponto = get_object_or_404(Ponto, pk=pk)
    ponto.status = status
    ponto.save(update_fields=["status"])
    return JsonResponse(serializar(ponto, admin=True))


@require_POST
@staff_required
def api_admin_excluir(request, pk):
    ponto = get_object_or_404(Ponto, pk=pk)
    if ponto.imagem:
        ponto.imagem.delete(save=False)
    ponto.delete()
    return JsonResponse({"ok": True})


def _relato(r):
    return {
        "id": r.id, "ponto_id": r.ponto_id, "ponto_nome": r.ponto.nome,
        "motivo": r.motivo, "motivo_nome": r.get_motivo_display(),
        "detalhe": r.detalhe, "criado_em": r.criado_em.strftime("%d/%m/%Y %H:%M"),
    }


@require_GET
@staff_required
def api_admin_relatos(request):
    qs = Relato.objects.filter(resolvido=False).select_related("ponto")
    return JsonResponse([_relato(r) for r in qs], safe=False)


@require_POST
@staff_required
def api_admin_relato_resolver(request, pk):
    r = get_object_or_404(Relato, pk=pk)
    r.resolvido = True
    r.save(update_fields=["resolvido"])
    return JsonResponse({"ok": True})


# ---------- página informativa ----------

SVG = {
    "pilhas": '<path d="M2 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"/><path d="M22 11v2"/><path d="M6 10v4"/>',
    "medicamentos": '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    "oleo": '<path d="M12 2.7 17.7 8.4a8 8 0 1 1-11.4 0Z"/>',
    "eletronicos": '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
    "lampadas": '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-4 10.5c.7.6 1.2 1.4 1.4 2.5h5.2c.2-1.1.7-1.9 1.4-2.5A6 6 0 0 0 12 2Z"/>',
}

GUIA = [
    {"tipo": "pilhas", "nome": "Pilhas e Baterias", "cor": "#FF5D73",
     "porque": "Contêm metais pesados, como chumbo, cádmio e mercúrio, que contaminam o solo e a água quando vão para o lixo comum.",
     "como": ["Junte as pilhas e baterias usadas em um pote ou saquinho fechado.",
              "Leve a um ponto de recebimento: lojas que vendem pilhas e baterias, assistências técnicas e ecopontos.",
              "Baterias de celular, notebook e câmeras também entram aqui."],
     "nao": ["Não jogue no lixo comum nem queime.", "Não fure nem desmonte a bateria."],
     "base": "Pilhas e baterias fazem parte da logística reversa prevista na Política Nacional de Resíduos Sólidos (Lei 12.305/2010)."},
    {"tipo": "medicamentos", "nome": "Medicamentos", "cor": "#2DD4BF",
     "porque": "Remédio jogado na pia, no vaso ou no lixo comum contamina a água e o solo e pode parar nas mãos de outras pessoas ou de animais.",
     "como": ["Leve os medicamentos vencidos ou sem uso a uma farmácia ou drogaria com ponto de recebimento.",
              "As embalagens, mesmo vazias, também podem ser entregues.",
              "Se puder, entregue na embalagem original, com o nome do remédio visível."],
     "nao": ["Não jogue na pia, no vaso sanitário nem no lixo comum.", "Não deixe ao alcance de crianças enquanto aguarda o descarte."],
     "base": "A logística reversa de medicamentos domiciliares de uso humano é regulamentada pelo Decreto Federal 10.388/2020, com pontos de recebimento em farmácias e drogarias. Resíduos de hospitais e clínicas seguem outras regras."},
    {"tipo": "oleo", "nome": "Óleo de Cozinha Usado", "cor": "#FFB238",
     "porque": "Jogado na pia, entope o encanamento e, ao chegar aos rios, forma uma película que prejudica a vida na água.",
     "como": ["Espere o óleo esfriar e coloque em uma garrafa PET com tampa (use um funil, se precisar).",
              "Guarde a garrafa fechada até encher e entregue em um ponto de coleta de óleo de cozinha usado.",
              "Procure ecopontos, associações de catadores e programas de coleta do município; confira no mapa."],
     "nao": ["Não jogue na pia, no ralo nem no vaso.", "Não misture com água ou outros líquidos."],
     "base": "Em geral, a coleta é organizada por programas locais, ecopontos e empresas de reciclagem. Por isso vale confirmar o ponto antes de ir."},
    {"tipo": "eletronicos", "nome": "Resíduos Eletrônicos", "cor": "#8B7BFF",
     "porque": "Placas e componentes têm metais pesados e materiais reaproveitáveis. No lixo comum viram contaminação e desperdício.",
     "como": ["Reúna celulares, carregadores, cabos, controles, fones, computadores e pequenos eletrônicos sem uso.",
              "Antes, apague seus dados (celulares e computadores) e retire as pilhas ou baterias.",
              "Entregue em lojas do ramo, assistências técnicas ou ecopontos que recebem eletrônicos."],
     "nao": ["Não jogue no lixo comum nem deixe na rua.", "Não desmonte o aparelho em casa."],
     "base": "Produtos eletroeletrônicos fazem parte da logística reversa da Política Nacional de Resíduos Sólidos (Lei 12.305/2010)."},
    {"tipo": "lampadas", "nome": "Lâmpadas Fluorescentes e de Vapor", "cor": "#4EA1FF",
     "porque": "Contêm mercúrio, que é tóxico. Quebradas no lixo comum, liberam o metal no ambiente.",
     "como": ["Guarde a lâmpada na própria caixa ou embrulhada em jornal, sem quebrar.",
              "Leve a um ponto de recebimento: lojas que vendem lâmpadas, supermercados e ecopontos que aceitam.",
              "Se quebrar: ventile o ambiente, recolha os cacos com luvas e papel úmido (sem aspirador) e leve em saco fechado ao ponto de coleta."],
     "nao": ["Não jogue no lixo comum.", "Não quebre de propósito."],
     "base": "Lâmpadas fluorescentes de vapor de sódio e mercúrio e de luz mista fazem parte da logística reversa da Política Nacional de Resíduos Sólidos (Lei 12.305/2010)."},
]


def como_descartar(request):
    guia = [dict(g, svg=mark_safe(SVG[g["tipo"]])) for g in GUIA]
    return render(request, "mapa/como_descartar.html", {"guia": guia})
