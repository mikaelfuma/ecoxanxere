from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from mapa.models import Ponto

IMG_DIR = Path(__file__).resolve().parents[2] / "static" / "mapa" / "imagens"

# (nome, bairro, tipo, lat, lng, usa_imagem)
PONTOS = [
    ("Ecoponto Pilhas", "Centro", "pilhas", -26.8770, -52.4040, False),
    ("Coleta Baterias", "Zona Industrial", "pilhas", -26.8850, -52.4100, True),
    ("Ponto Pilhas", "São Cristóvão", "pilhas", -26.8830, -52.3990, True),
    ("Farmácia Popular", "Centro", "medicamentos", -26.8760, -52.4010, False),
    ("UBS Bela Vista", "Bela Vista", "medicamentos", -26.8695, -52.3980, True),
    ("Drogaria Central", "Centro", "medicamentos", -26.8820, -52.4060, True),
    ("Ecoponto Óleo", "Vila Nova", "oleo", -26.8650, -52.4020, False),
    ("Coleta Óleo", "Bairro Presidente", "oleo", -26.8950, -52.4020, True),
    ("Restaurante Popular", "Centro", "oleo", -26.8790, -52.3950, True),
    ("Ecoponto Eletrônicos", "Zona Industrial", "eletronicos", -26.8900, -52.4050, False),
    ("Coleta de Eletrônicos", "Campus IFSC", "eletronicos", -26.8730, -52.4120, True),
    ("Ponto E-lixo", "Rio Verde", "eletronicos", -26.8680, -52.4110, True),
    ("Ecoponto Lâmpadas", "Centro", "lampadas", -26.8780, -52.4070, False),
    ("Coleta de Lâmpadas", "Bairro Norte", "lampadas", -26.8700, -52.4090, True),
    ("Ponto Lâmpadas", "Bairro Sul", "lampadas", -26.8930, -52.3960, True),
]


ACEITA = {
    "pilhas": "Pilhas e baterias de uso doméstico",
    "medicamentos": "Medicamentos vencidos ou sem uso, na embalagem",
    "oleo": "Óleo de cozinha usado, em garrafa PET fechada",
    "eletronicos": "Celulares, carregadores, cabos e pequenos eletrônicos",
    "lampadas": "Lâmpadas fluorescentes e de vapor, sem quebrar",
}


class Command(BaseCommand):
    help = "Cria os pontos fictícios de exemplo (já aprovados)."

    def handle(self, *args, **opts):
        criados = 0
        for nome, bairro, tipo, lat, lng, com_img in PONTOS:
            p, novo = Ponto.objects.get_or_create(
                nome=nome, bairro=bairro, tipo=tipo,
                defaults={"lat": lat, "lng": lng, "status": "aprovado",
                          "horario": "Seg a Sex, 8h às 18h (exemplo)",
                          "aceita": ACEITA[tipo]},
            )
            if novo and com_img:
                arq = IMG_DIR / f"{tipo}.jpg"
                p.imagem.save(f"{tipo}.jpg", ContentFile(arq.read_bytes()), save=True)
            criados += novo
        self.stdout.write(self.style.SUCCESS(f"{criados} pontos criados."))
