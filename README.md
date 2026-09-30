# RangoTime

Hora do rango: planejamento semanal de alimentação.

Página estática (GitHub Pages) pensada para celular, principalmente iPhone: barra de abas embaixo, conteúdo em cards e suporte a notch/barra inferior do iOS.

- **Semana**: o que fazer hoje (refeição do dia, o que descongelar), cardápio em cards deslizáveis, blocos de preparo, onde guardar cada coisa e fluxo recomendado.
- **Compras**: Compra 1, Compra 2 e despensa, com checkboxes (o progresso fica salvo no aparelho) e botão para compartilhar as listas (WhatsApp, Notas etc.).
- **Preparo**: ingredientes, materiais, passo a passo marcável e montagem de cada refeição, além da estratégia de preparo paralelo.
- **Passeios**: Assistente Diário da Família. Todo dia de manhã, sugestões para hoje e para o próximo fim de semana com crianças de 0 a 6 anos, cruzando clima, eventos, parques e praias. Arquitetura, APIs, horários, fontes e WhatsApp em [`ASSISTENTE-FAMILIA.md`](ASSISTENTE-FAMILIA.md).

## Instalar no iPhone como app

1. Abra o link no **Safari**.
2. Toque em **Compartilhar** → **Adicionar à Tela de Início**.
3. O RangoTime ganha ícone próprio, abre em tela cheia (sem a barra do navegador) e funciona offline depois do primeiro acesso.

Todo o conteúdo fica em [`docs/data.json`](docs/data.json). Para alterar refeições, itens ou dias, edite esse arquivo.

## Publicar no GitHub Pages

1. Em **Settings → Pages → Build and deployment**, escolha **Source: Deploy from a branch**, branch **main** e pasta **/docs**. Salve.
2. Em 1–2 minutos a página fica em https://alexandrealvesdecarvalhodevin-pixel.github.io/RangoTime/
3. Cada alteração na pasta `docs/` da `main` republica automaticamente.

## Lembretes por e-mail (grátis, via GitHub Actions)

O workflow `lembretes.yml` roda todo dia às 18h (horário de Brasília) e envia um e-mail quando há algo a fazer:

| Dia     | Lembrete                                            |
|---------|-----------------------------------------------------|
| Domingo | Lista da Compra 1 + despensa, descongelar carne moída |
| Segunda | Descongelar contra-filé                             |
| Terça   | Descongelar almôndegas                              |
| Quarta  | Lista da Compra 2, descongelar frango               |
| Quinta  | Descongelar fígado                                  |
| Sexta   | Descongelar espetinho                               |

### Ativar o workflow

Por segurança, integrações externas não podem criar arquivos em `.github/workflows/`, por isso o workflow está em [`ativar-workflow/lembretes.yml`](ativar-workflow/lembretes.yml). Para ativar pelo navegador:

1. Abra `ativar-workflow/lembretes.yml` no GitHub e clique no lápis (**Edit**).
2. No campo do nome do arquivo, apague `ativar-workflow/` e digite `.github/workflows/lembretes.yml`.
3. Clique em **Commit changes**.

### Configuração (Gmail)

1. Ative a verificação em duas etapas na conta Google e crie uma **senha de app** em https://myaccount.google.com/apppasswords.
2. No repositório, vá em **Settings → Secrets and variables → Actions → New repository secret** e crie:
   - `EMAIL_USUARIO`: seu endereço Gmail (remetente).
   - `EMAIL_SENHA`: a senha de app de 16 caracteres.
   - `EMAIL_DESTINO` (opcional): quem recebe. Pode ter vários, separados por vírgula. Se ficar vazio, envia para o próprio `EMAIL_USUARIO`.
3. Teste em **Actions → Lembretes por e-mail → Run workflow** (dá para simular um dia: 0 = domingo, 3 = quarta).

Para usar outro provedor, crie as *variables* `SMTP_HOST` e `SMTP_PORT` (465 = SSL, 587 = STARTTLS).

> O GitHub pode atrasar execuções agendadas em alguns minutos e desativa agendamentos de repositórios sem atividade há 60 dias (basta reativar em Actions).

## Rodar localmente

```bash
cd docs && python3 -m http.server 8080
# abra http://localhost:8080
```
