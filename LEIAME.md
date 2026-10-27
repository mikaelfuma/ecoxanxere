# EcoXanxerê (Django)

## Banco de dados (MySQL)
O projeto usa MySQL. O acesso fica em **config/settings.py**, no bloco `DATABASES`
(banco `barbearia`, usuário `root`, senha `1234`, `localhost:3306`). Para usar outro banco,
crie-o no MySQL (`CREATE DATABASE ecoxanxere CHARACTER SET utf8mb4;`) e troque o `NAME`.
O MySQL precisa estar ligado antes do `migrate`. O driver é o `mysqlclient` (já no requirements.txt;
no Windows costuma instalar direto com pip, no Linux precisa de `libmysqlclient-dev`).

## Rodar
```
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_pontos        # 15 pontos de exemplo (opcional)
python manage.py createsuperuser    # cria SEU login de administrador
python manage.py runserver
```
Site: http://127.0.0.1:8000/

## Administrar pelo próprio site (sem mexer em código)
1. Abra o site, role o painel lateral até o fim e clique em **Área da administração**.
2. Entre com o usuário/senha criados no `createsuperuser`.
3. Com o login ativo, aparece a barra **Modo administrador**:
   - **+ Novo ponto**: nome, bairro, tipo, horário, telefone, o que aceita, data da última verificação, foto e posição (botão "Marcar no mapa", depois é só clicar no mapa).
   - **✎** em cada ponto (ou "Editar ponto" no popup): altera qualquer dado, troca/remove a foto ou exclui o ponto.
   - **✓ / ✕**: aprova ou rejeita as sugestões do público (aparecem como "Pendente").
   - **Mostrar**: filtra por pendentes, aprovados ou rejeitados.
4. **Sair da administração** no mesmo lugar.

O público só vê pontos aprovados. Sugestões enviadas por visitantes ficam pendentes até você aprovar.
Só usuários com permissão de equipe (`is_staff`) conseguem entrar. Depois de 5 senhas erradas, o IP fica bloqueado por 15 minutos.

O `/admin/` padrão do Django continua disponível para criar outros usuários.

## Antes de publicar de verdade
Trocar a senha do MySQL (`root`/`1234` é só para desenvolvimento), definir as variáveis de ambiente `SECRET_KEY`, `DEBUG=0` e `ALLOWED_HOSTS=seudominio.com`, e rodar `python manage.py collectstatic`.
Para receber e-mail de aviso de sugestão/problema: `EMAIL_AVISO=seu@email.com` (+ `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` para enviar de verdade; sem isso, só imprime no terminal).
Atrás de proxy (ex.: PythonAnywhere): `CONFIAR_PROXY=1`, para o limite anti-spam enxergar o IP real.
Use HTTPS (assim o login não trafega aberto) e, em produção, sirva a pasta `media/` (fotos) pelo servidor web.
