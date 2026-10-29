// Centro do mapa: Xanxerê - SC
const XANXERE = [-26.8776, -52.4033];

const map = L.map('map', { zoomControl: false }).setView(XANXERE, 13.5);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Botão "usar minha localização"
const ControleLocalizacao = L.Control.extend({
  options: { position: 'bottomright' },
  onAdd: function () {
    const btn = L.DomUtil.create('button', 'btn-geo');
    btn.type = 'button';
    btn.title = 'Usar minha localização';
    btn.setAttribute('aria-label', 'Usar minha localização');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`;
    L.DomEvent.disableClickPropagation(btn);
    btn.addEventListener('click', localizarUsuario);
    return btn;
  }
});
map.addControl(new ControleLocalizacao());

let marcadorUsuario = null;
function localizarUsuario() {
  if (!navigator.geolocation) {
    alert('Seu navegador não suporta geolocalização.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (marcadorUsuario) map.removeLayer(marcadorUsuario);
      marcadorUsuario = L.circleMarker([latitude, longitude], {
        radius: 8, color: '#fff', weight: 3, fillColor: '#3E7CB1', fillOpacity: 1
      }).addTo(map);
      map.setView([latitude, longitude], 15);
      posUsuario = { lat: latitude, lng: longitude };
      atualizarDistancias();
    },
    () => alert('Não foi possível obter sua localização. Verifique a permissão do navegador.')
  );
}

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Cores por tipo de resíduo (mesma saturação/luminosidade, matizes espaçados)
const CORES = {
  pilhas: '#D64550',
  medicamentos: '#3BA99C',
  oleo: '#E2A33D',
  eletronicos: '#6B5FD1',
  lampadas: '#3E7CB1'
};

// Ícones em linha (estilo lucide), não emoji — consistentes em qualquer aparelho
const ICONES = {
  pilhas: '<path d="M2 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"/><path d="M22 11v2"/><path d="M6 10v4"/>',
  medicamentos: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  oleo: '<path d="M12 2.7 17.7 8.4a8 8 0 1 1-11.4 0Z"/>',
  eletronicos: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
  lampadas: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-4 10.5c.7.6 1.2 1.4 1.4 2.5h5.2c.2-1.1.7-1.9 1.4-2.5A6 6 0 0 0 12 2Z"/>'
};

function svgIcone(tipo, tamanho) {
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[tipo]}</svg>`;
}

const NOMES_TIPO = {
  pilhas: 'Pilhas e Baterias',
  medicamentos: 'Medicamentos',
  oleo: 'Óleo de Cozinha Usado',
  eletronicos: 'Resíduos Eletrônicos',
  lampadas: 'Lâmpadas Fluorescentes/Vapor'
};

// ---------- utilidades ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const getCookie = (n) => (document.cookie.match('(?:^|; )' + n + '=([^;]*)') || [])[1] || '';

async function api(url, { method = 'GET', json, form } = {}) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (method !== 'GET') opts.headers['X-CSRFToken'] = getCookie('csrftoken');
  if (json) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(json); }
  if (form) opts.body = form;
  try {
    const r = await fetch(url, opts);
    let data = null;
    try { data = await r.json(); } catch { /* sem corpo */ }
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { erro: 'Sem conexão com o servidor.' } };
  }
}

function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

let posUsuario = null;

function distKm(p) {
  if (!posUsuario) return null;
  const R = 6371, rad = (x) => x * Math.PI / 180;
  const dLat = rad(p.lat - posUsuario.lat), dLng = rad(p.lng - posUsuario.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(posUsuario.lat)) * Math.cos(rad(p.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function fmtDist(km) {
  return km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visivel');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('visivel'), 3500);
}

// ---------- estado ----------
let admin = false;
let tipoAtivo = 'todos';
let statusAtivo = 'todos';
const PONTOS = [];
const registros = []; // { ponto, marker, li }
const camada = L.layerGroup().addTo(map);

const sidebar = document.getElementById('sidebar');
const lista = document.getElementById('lista-pontos');
const campoBusca = document.getElementById('busca');

const STATUS_NOME = { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };

// ---------- marcador, popup e item da lista ----------
function iconePara(tipo) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50% 50% 50% 0;
      background:${CORES[tipo]};border:2.5px solid #fff;
      transform:rotate(-45deg);color:#fff;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 8px rgba(32,35,42,0.35);">
      <span style="transform:rotate(45deg);display:flex;">${svgIcone(tipo, 14)}</span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

function midiaHtml(p, classeWrap, classeIcone, classeImg, tam) {
  const cor = CORES[p.tipo];
  const icone = `<div class="${classeIcone}" style="background:${cor}17;color:${cor};">${svgIcone(p.tipo, tam)}</div>`;
  if (!p.imagem) return icone;
  return `<div class="${classeWrap}">${icone}<img class="${classeImg}" src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy" onerror="this.remove()"></div>`;
}

function popupEl(p) {
  const cor = CORES[p.tipo];
  const rota = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const tel = p.telefone ? `<a href="tel:${esc(p.telefone.replace(/[^\d+]/g, ''))}">${esc(p.telefone)}</a>` : '';
  const linhas = [
    p.horario && `<li><span>Horário</span>${esc(p.horario)}</li>`,
    tel && `<li><span>Telefone</span>${tel}</li>`,
    p.aceita && `<li><span>Aceita</span>${esc(p.aceita)}</li>`
  ].filter(Boolean).join('');
  const verificado = p.verificado_em ? `<p class="popup-verificado">Verificado em ${dataBR(p.verificado_em)}</p>` : '';
  const faixa = admin && p.status && p.status !== 'aprovado'
    ? `<div class="faixa-status faixa-${p.status}">${STATUS_NOME[p.status]} — não aparece para o público</div>` : '';

  const el = document.createElement('div');
  el.className = 'popup-card';
  el.innerHTML = `
    ${faixa}
    ${midiaHtml(p, 'midia-wrap', 'popup-media-icone', 'popup-media', 30)}
    <div class="popup-body">
      <span class="badge" style="background:${cor}17;color:${cor};">${NOMES_TIPO[p.tipo]}</span>
      <b>${esc(p.nome)}</b>
      <p class="popup-bairro">${esc(p.bairro)} · Xanxerê, SC${distKm(p) != null ? ` · <b class="dist-popup">a ${fmtDist(distKm(p))}</b>` : ''}</p>
      ${linhas ? `<ul class="popup-info">${linhas}</ul>` : ''}
      ${verificado}
      <a class="popup-rota" href="${rota}" target="_blank" rel="noopener">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        Como chegar
      </a>
      ${admin ? '<button type="button" class="popup-editar">Editar ponto</button>' : '<button type="button" class="popup-reportar">Reportar problema</button>'}
    </div>`;
  const bt = el.querySelector('.popup-editar');
  if (bt) bt.addEventListener('click', () => abrirEditor(p));
  const br = el.querySelector('.popup-reportar');
  if (br) br.addEventListener('click', () => abrirRelato(p));
  return el;
}

function acaoBtn(classe, titulo, texto, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'acao ' + classe;
  b.title = titulo;
  b.setAttribute('aria-label', titulo);
  b.textContent = texto;
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
}

function itemListaEl(p, aoClicar) {
  const cor = CORES[p.tipo];
  const li = document.createElement('li');
  li.innerHTML = `${midiaHtml(p, 'thumb-wrap', 'thumb', 'thumb thumb-img', 20)}
    <div class="info">
      <b>${esc(p.nome)}</b>
      <span class="local">${esc(p.bairro)}${distKm(p) != null ? ` · <span class="dist">a ${fmtDist(distKm(p))}</span>` : ''}</span>
      <span class="badge" style="background:${cor}17;color:${cor};">${NOMES_TIPO[p.tipo]}</span>
      ${admin && p.status !== 'aprovado' ? `<span class="badge-status badge-${p.status}">${STATUS_NOME[p.status]}</span>` : ''}
    </div>`;
  if (admin) {
    const acoes = document.createElement('div');
    acoes.className = 'acoes';
    if (p.status !== 'aprovado') acoes.appendChild(acaoBtn('aprovar', 'Aprovar', '✓', () => mudarStatus(p, 'aprovado')));
    if (p.status === 'pendente') acoes.appendChild(acaoBtn('rejeitar', 'Rejeitar', '✕', () => mudarStatus(p, 'rejeitado')));
    acoes.appendChild(acaoBtn('editar', 'Editar', '✎', () => abrirEditor(p)));
    li.appendChild(acoes);
  }
  li.addEventListener('click', aoClicar);
  li.setAttribute('tabindex', '0');
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter') aoClicar(); });
  lista.appendChild(li);
  return li;
}

function registrarPonto(p) {
  const marker = L.marker([p.lat, p.lng], { icon: iconePara(p.tipo) });
  marker.bindPopup(() => popupEl(p));
  if (p.status && p.status !== 'aprovado') marker.setOpacity(0.55);

  const li = itemListaEl(p, () => {
    map.setView([p.lat, p.lng], 17);
    marker.openPopup();
    sidebar.classList.remove('aberta');
  });
  registros.push({ ponto: p, marker, li });
}

function limpar() {
  registros.forEach(({ marker, li }) => { camada.removeLayer(marker); li.remove(); });
  registros.length = 0;
  PONTOS.length = 0;
}

async function carregar() {
  const r = await api(admin ? '/api/admin/pontos/' : '/api/pontos/');
  limpar();
  if (!r.ok) {
    const v = document.getElementById('vazio');
    v.textContent = 'Não foi possível carregar os pontos.';
    v.style.display = 'block';
    return;
  }
  r.data.forEach(p => { PONTOS.push(p); registrarPonto(p); });
  if (posUsuario) ordenarPorDistancia();
  aplicarFiltros();
  carregarRelatos();
}

function topoDaLista() { sidebar.scrollTop = 0; }

// ---------- filtros ----------
function passaStatus(p) {
  return !admin || statusAtivo === 'todos' || p.status === statusAtivo;
}

function atualizarContadoresChips() {
  document.querySelectorAll('.chip').forEach(chip => {
    const tipo = chip.dataset.tipo;
    const n = PONTOS.filter(p => passaStatus(p) && (tipo === 'todos' || p.tipo === tipo)).length;
    const el = chip.querySelector('.chip-contagem');
    if (el) el.textContent = n;
  });
}

function aplicarFiltros() {
  const termo = campoBusca.value.trim().toLowerCase();
  let visiveis = 0;

  registros.forEach(({ ponto, marker, li }) => {
    const mostra = passaStatus(ponto)
      && (tipoAtivo === 'todos' || ponto.tipo === tipoAtivo)
      && (!termo || ponto.nome.toLowerCase().includes(termo) || ponto.bairro.toLowerCase().includes(termo));
    li.style.display = mostra ? 'flex' : 'none';
    if (mostra) { camada.addLayer(marker); visiveis++; } else { camada.removeLayer(marker); }
  });

  atualizarContadoresChips();
  document.getElementById('contagem').textContent = visiveis;
  const v = document.getElementById('vazio');
  v.textContent = 'Nenhum ponto encontrado com esse filtro.';
  v.style.display = visiveis === 0 ? 'block' : 'none';
  const pend = PONTOS.filter(p => p.status === 'pendente').length;
  document.getElementById('contagem-pendentes').textContent = pend;
}

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    tipoAtivo = chip.dataset.tipo;
    aplicarFiltros();
  });
});
campoBusca.addEventListener('input', aplicarFiltros);
document.getElementById('filtro-status').addEventListener('change', (e) => {
  statusAtivo = e.target.value;
  aplicarFiltros();
});

// Abrir lista pelo botão do cabeçalho
document.getElementById('btn-lista').addEventListener('click', () => {
  sidebar.classList.add('aberta');
  document.getElementById('btn-lista').setAttribute('aria-expanded', 'true');
  campoBusca.focus();
});

// Botão flutuante do mapa
const btnMapaPontos = document.getElementById('btn-mapa-pontos');

btnMapaPontos.addEventListener('click', () => {
  sidebar.classList.add('aberta');
  document.getElementById('btn-lista').setAttribute('aria-expanded', 'true');
  btnMapaPontos.classList.add('oculto');
  campoBusca.focus();
});

// Fechar lista
document.getElementById('fechar-lista').addEventListener('click', () => {
  sidebar.classList.remove('aberta');
  document.getElementById('btn-lista').setAttribute('aria-expanded', 'false');
});

// Fechar painel de pontos ao clicar no mapa
map.getContainer().addEventListener('click', () => {
  sidebar.classList.remove('aberta');
  document.getElementById('btn-lista').setAttribute('aria-expanded', 'false');
});

// Clicar no mapa faz o botão voltar em formato compacto
map.on('click', () => {
  btnMapaPontos.classList.remove('oculto');
  btnMapaPontos.classList.add('compacto');
});
document.getElementById('fechar-lista').addEventListener('click', () => sidebar.classList.remove('aberta'));

// ---------- clique no mapa: escolher posição (admin) ou sugerir (público) ----------
let pontoTemp = null;
let marcadorTemp = null;
let escolhendoPosicao = false;

map.on('click', (e) => {
  if (escolhendoPosicao) {
    escolhendoPosicao = false;
    document.body.classList.remove('escolhendo');
    document.getElementById('f-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('f-lng').value = e.latlng.lng.toFixed(6);
    document.getElementById('modal-ponto').hidden = false;
    return;
  }
  if (admin) return;
  if (marcadorTemp) map.removeLayer(marcadorTemp);
  pontoTemp = e.latlng;
  marcadorTemp = L.circleMarker(pontoTemp, { radius: 7, color: '#333', fillOpacity: 0.5 }).addTo(map);
  document.getElementById('dica').textContent =
    `Posição selecionada: ${pontoTemp.lat.toFixed(5)}, ${pontoTemp.lng.toFixed(5)}`;
});

// ---------- sugestão do público (fica pendente) ----------
document.getElementById('form-ponto').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pontoTemp) { alert('Clique no mapa para escolher a posição do ponto.'); return; }
  const tipo = document.getElementById('tipo-selecionado').value;
  if (!tipo) { alert('Escolha o tipo de resíduo.'); return; }

  const form = new FormData();
  form.append('nome', document.getElementById('nome').value);
  form.append('bairro', document.getElementById('bairro').value || 'Xanxerê');
  form.append('tipo', tipo);
  form.append('lat', pontoTemp.lat);
  form.append('lng', pontoTemp.lng);
  form.append('website', document.getElementById('sug-website').value);
  const foto = document.getElementById('sug-imagem').files[0];
  if (foto) form.append('imagem', foto);
  const r = await api('/api/sugerir/', { method: 'POST', form });
  if (!r.ok) { alert((r.data && r.data.erro) || 'Não foi possível enviar a sugestão. Tente novamente.'); return; }

  if (marcadorTemp) map.removeLayer(marcadorTemp);
  pontoTemp = null;
  document.getElementById('form-ponto').reset();
  document.querySelectorAll('.tipo-opcao').forEach(b => b.classList.remove('selecionada'));
  document.getElementById('tipo-selecionado').value = '';
  document.getElementById('dica').textContent = 'Sugestão enviada! Ela vai aparecer no mapa assim que for aprovada pela administração. Clique no mapa para enviar outra.';
alert('Sugestão enviada com sucesso! Aguarde a aprovação da administração.');
});

const gradeTipos = document.getElementById('grade-tipos');
Object.keys(CORES).forEach(tipo => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tipo-opcao';
  btn.dataset.tipo = tipo;
  btn.style.setProperty('--cor-tipo', CORES[tipo]);
  btn.innerHTML = `${svgIcone(tipo, 18)}<span>${NOMES_TIPO[tipo]}</span>`;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tipo-opcao').forEach(b => b.classList.remove('selecionada'));
    btn.classList.add('selecionada');
    document.getElementById('tipo-selecionado').value = tipo;
  });
  gradeTipos.appendChild(btn);
});

// ---------- login / logout ----------
const modalLogin = document.getElementById('modal-login');
const btnLogin = document.getElementById('btn-login');

function atualizarModoAdmin() {
  document.body.classList.toggle('modo-admin', admin);
  document.getElementById('barra-admin').hidden = !admin;
  document.getElementById('add-ponto').hidden = admin;
  btnLogin.textContent = admin ? 'Sair da administração' : 'Área da administração';
  if (!admin) { statusAtivo = 'todos'; document.getElementById('filtro-status').value = 'todos'; }
}

btnLogin.addEventListener('click', async () => {
  if (admin) {
    await api('/api/logout/', { method: 'POST' });
    admin = false;
    atualizarModoAdmin();
    await carregar();
    topoDaLista();
    toast('Você saiu da administração.');
  } else {
    document.getElementById('login-erro').textContent = '';
    modalLogin.hidden = false;
    document.getElementById('login-usuario').focus();
  }
});

document.getElementById('login-cancelar').addEventListener('click', () => { modalLogin.hidden = true; });

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await api('/api/login/', {
    method: 'POST',
    json: { usuario: document.getElementById('login-usuario').value, senha: document.getElementById('login-senha').value }
  });
  if (!r.ok) {
    document.getElementById('login-erro').textContent = (r.data && r.data.erro) || 'Não foi possível entrar.';
    return;
  }
  document.getElementById('form-login').reset();
  modalLogin.hidden = true;
  admin = true;
  atualizarModoAdmin();
  sidebar.classList.add('aberta');
  await carregar();
  topoDaLista();
  toast('Modo administrador ativado.');
});

// ---------- editor de ponto (admin) ----------
const modalPonto = document.getElementById('modal-ponto');
const formEditor = document.getElementById('form-editor');
const f = (id) => document.getElementById(id);

Object.entries(NOMES_TIPO).forEach(([v, n]) => f('f-tipo').add(new Option(n, v)));

function abrirEditor(p) {
  const novo = !p;
  formEditor.reset();
  f('editor-erro').textContent = '';
  f('editor-titulo').textContent = novo ? 'Novo ponto' : 'Editar ponto';
  f('f-id').value = novo ? '' : p.id;
  f('f-nome').value = novo ? '' : p.nome;
  f('f-bairro').value = novo ? '' : p.bairro;
  f('f-tipo').value = novo ? 'pilhas' : p.tipo;
  f('f-horario').value = novo ? '' : p.horario;
  f('f-telefone').value = novo ? '' : p.telefone;
  f('f-aceita').value = novo ? '' : p.aceita;
  f('f-verificado').value = novo ? new Date().toISOString().slice(0, 10) : (p.verificado_em || '');
  f('f-status').value = novo ? 'aprovado' : p.status;
  f('f-lat').value = novo ? '' : p.lat;
  f('f-lng').value = novo ? '' : p.lng;
  f('f-imagem-atual').hidden = novo || !p.imagem;
  f('f-imagem-atual-img').src = (!novo && p.imagem) ? p.imagem : '';
  f('editor-excluir').hidden = novo;
  modalPonto.hidden = false;
  map.closePopup();
}

f('btn-novo-ponto').addEventListener('click', () => { abrirEditor(null); sidebar.classList.remove('aberta'); });
f('editor-cancelar').addEventListener('click', () => { modalPonto.hidden = true; });

f('editor-posicao').addEventListener('click', () => {
  modalPonto.hidden = true;
  escolhendoPosicao = true;
  document.body.classList.add('escolhendo');
  toast('Clique no mapa para marcar a posição do ponto.');
});

formEditor.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!f('f-lat').value || !f('f-lng').value) {
    f('editor-erro').textContent = 'Marque a posição no mapa.';
    return;
  }
  const form = new FormData();
  form.append('id', f('f-id').value);
  form.append('nome', f('f-nome').value);
  form.append('bairro', f('f-bairro').value || 'Xanxerê');
  form.append('tipo', f('f-tipo').value);
  form.append('horario', f('f-horario').value);
  form.append('telefone', f('f-telefone').value);
  form.append('aceita', f('f-aceita').value);
  form.append('verificado_em', f('f-verificado').value);
  form.append('status', f('f-status').value);
  form.append('lat', f('f-lat').value.replace(',', '.'));
  form.append('lng', f('f-lng').value.replace(',', '.'));
  if (f('f-imagem').files[0]) form.append('imagem', f('f-imagem').files[0]);
  if (f('f-remover-imagem').checked) form.append('remover_imagem', '1');

  const r = await api('/api/admin/pontos/salvar/', { method: 'POST', form });
  if (!r.ok) {
    f('editor-erro').textContent = (r.data && r.data.erro) || 'Não foi possível salvar.';
    return;
  }
  modalPonto.hidden = true;
  await carregar();
  const salvo = registros.find(x => x.ponto.id === r.data.id);
  if (salvo) { map.setView([salvo.ponto.lat, salvo.ponto.lng], 17); salvo.marker.openPopup(); }
  toast('Ponto salvo.');
});

f('editor-excluir').addEventListener('click', async () => {
  const id = f('f-id').value;
  if (!id || !confirm('Excluir este ponto definitivamente?')) return;
  const r = await api(`/api/admin/pontos/${id}/excluir/`, { method: 'POST' });
  if (!r.ok) { f('editor-erro').textContent = 'Não foi possível excluir.'; return; }
  modalPonto.hidden = true;
  await carregar();
  toast('Ponto excluído.');
});

async function mudarStatus(p, status) {
  const r = await api(`/api/admin/pontos/${p.id}/status/`, { method: 'POST', json: { status } });
  if (!r.ok) { toast('Não foi possível alterar o status.'); return; }
  await carregar();
  toast(status === 'aprovado' ? 'Ponto aprovado e publicado.' : 'Ponto rejeitado.');
}

// ---------- distância até o usuário ----------
function ordenarPorDistancia() {
  registros.sort((a, b) => distKm(a.ponto) - distKm(b.ponto));
  registros.forEach(({ li }) => lista.appendChild(li));
}

function atualizarDistancias() {
  registros.forEach(({ ponto, li }) => {
    const local = li.querySelector('.local');
    if (!local) return;
    let d = local.querySelector('.dist');
    if (!d) { local.append(' · '); d = document.createElement('span'); d.className = 'dist'; local.appendChild(d); }
    d.textContent = `a ${fmtDist(distKm(ponto))}`;
  });
  ordenarPorDistancia();
  document.getElementById('btn-distancia').textContent = 'Ordenado do mais perto ao mais longe';
  toast('Lista ordenada do ponto mais perto ao mais longe.');
}

document.getElementById('btn-distancia').addEventListener('click', () => {
  if (posUsuario) atualizarDistancias(); else localizarUsuario();
});

// ---------- reportar problema (público) ----------
let pontoRelato = null;

function abrirRelato(p) {
  pontoRelato = p;
  f('form-relato').reset();
  f('relato-erro').textContent = '';
  f('relato-ponto').textContent = p.nome;
  f('modal-relato').hidden = false;
  map.closePopup();
}
f('relato-cancelar').addEventListener('click', () => { f('modal-relato').hidden = true; });
f('form-relato').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await api('/api/reportar/', {
    method: 'POST',
    json: { ponto: pontoRelato.id, motivo: f('relato-motivo').value, detalhe: f('relato-detalhe').value, website: f('relato-website').value }
  });
  if (!r.ok) { f('relato-erro').textContent = (r.data && r.data.erro) || 'Não foi possível enviar.'; return; }
  f('modal-relato').hidden = true;
  toast('Obrigado! A administração vai verificar.');
});

// ---------- relatos (admin) ----------
let relatos = [];

async function carregarRelatos() {
  if (!admin) return;
  const r = await api('/api/admin/relatos/');
  relatos = r.ok ? r.data : [];
  f('contagem-relatos').textContent = relatos.length;
}

function renderRelatos() {
  const box = f('lista-relatos');
  box.innerHTML = '';
  if (!relatos.length) { box.innerHTML = '<p class="estado-vazio">Nenhum problema reportado.</p>'; return; }
  relatos.forEach(r => {
    const item = document.createElement('div');
    item.className = 'relato';
    item.innerHTML = `<div><b>${esc(r.ponto_nome)}</b>
      <span class="local">${esc(r.motivo_nome)} · ${esc(r.criado_em)}</span>
      ${r.detalhe ? `<p>${esc(r.detalhe)}</p>` : ''}</div>`;
    const acoes = document.createElement('div');
    acoes.className = 'relato-acoes';
    const ver = document.createElement('button'); ver.type = 'button'; ver.className = 'btn-sec'; ver.textContent = 'Ver ponto';
    ver.addEventListener('click', () => {
      const reg = registros.find(x => x.ponto.id === r.ponto_id);
      f('modal-relatos').hidden = true;
      if (reg) { map.setView([reg.ponto.lat, reg.ponto.lng], 17); reg.marker.openPopup(); }
    });
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn-primario'; ok.textContent = 'Resolvido';
    ok.addEventListener('click', async () => {
      await api(`/api/admin/relatos/${r.id}/resolver/`, { method: 'POST' });
      await carregarRelatos(); renderRelatos();
    });
    acoes.append(ver, ok);
    item.appendChild(acoes);
    box.appendChild(item);
  });
}

f('btn-relatos').addEventListener('click', async () => { await carregarRelatos(); renderRelatos(); f('modal-relatos').hidden = false; });
f('relatos-fechar').addEventListener('click', () => { f('modal-relatos').hidden = true; });

// Esc fecha os modais
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  modalLogin.hidden = true;
  modalPonto.hidden = true;
  f('modal-relato').hidden = true;
  f('modal-relatos').hidden = true;
  if (escolhendoPosicao) { escolhendoPosicao = false; document.body.classList.remove('escolhendo'); modalPonto.hidden = false; }
});

// ---------- início ----------
(async function iniciar() {
  const me = await api('/api/me/');
  admin = !!(me.ok && me.data && me.data.admin);
  atualizarModoAdmin();
  await carregar();
  topoDaLista();
})();
