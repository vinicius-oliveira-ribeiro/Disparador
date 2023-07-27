Disparador de E-mails - Documentação
Descrição
O Disparador de E-mails é um projeto Node.js desenvolvido para enviar e-mails automaticamente com base em um arquivo CSV contendo informações sobre o espaço em disco de contas de e-mail. Ele foi criado para monitorar o espaço em disco utilizado por várias contas de e-mail e notificar os usuários quando o espaço utilizado atingir um limite pré-definido.

O projeto utiliza o Node.js como ambiente de execução e o banco de dados PostgreSQL para armazenar as informações de controle e registro de envio de e-mails. Ele também faz uso das bibliotecas csv-parser, fs, nodemailer, pg, cron e date-fns.

Configuração
Para configurar e executar o projeto, siga os passos abaixo:

Clone o repositório para o seu ambiente local:
bash
Copy code
git clone <URL do repositório>
cd Disparador
Instale as dependências do projeto usando o gerenciador de pacotes npm:
Copy code
npm install
Crie um arquivo .env na raiz do projeto e adicione as seguintes variáveis de ambiente com suas respectivas configurações:
makefile
Copy code
DB_USER=seu_usuario_do_banco_de_dados
DB_HOST=seu_host_do_banco_de_dados
DB_NAME=seu_nome_do_banco_de_dados
DB_PASSWORD=sua_senha_do_banco_de_dados
DB_PORT=porta_do_banco_de_dados
EMAIL_USER=seu_email_para_envio_de_emails
EMAIL_PASS=sua_senha_do_email
Certifique-se de substituir os valores das variáveis acima pelos seus próprios.

Crie a tabela app_control no seu banco de dados PostgreSQL. Você pode usar o seguinte comando SQL:
sql
Copy code
CREATE TABLE IF NOT EXISTS public.app_control (
  id SERIAL PRIMARY KEY,
  app_name VARCHAR(255) NOT NULL,
  last_execution TIMESTAMP,
  next_execution TIMESTAMP,
  cron VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
Uso
O projeto possui os seguintes componentes principais:

1. index.js
O arquivo index.js é o ponto de entrada do aplicativo e contém o código principal que realiza o agendamento do envio de e-mails e o processamento de arquivos CSV. Ele também atualiza a data de próxima execução com base na configuração de cronograma armazenada no banco de dados.

Para iniciar o aplicativo, execute o seguinte comando:

sql
Copy code
npm start
2. Pasta downloads
Essa pasta é destinada ao armazenamento de arquivos CSV que serão lidos e processados pelo aplicativo. O aplicativo verifica periodicamente se existem arquivos na pasta e, se houver, processa-os e move-os para a pasta processado.

3. Pasta processar
Esta pasta é destinada ao armazenamento de arquivos CSV que foram processados pelo aplicativo. Após o processamento, o aplicativo move os arquivos da pasta downloads para cá.

4. Pasta processado
Nesta pasta, o aplicativo armazena os arquivos CSV que foram processados com sucesso e movidos a partir da pasta processar.

5. Banco de Dados PostgreSQL
O aplicativo utiliza um banco de dados PostgreSQL para armazenar informações sobre o controle de execução e o registro de envio de e-mails. A tabela app_control armazena informações sobre os agendamentos e cronogramas de execução.

Configuração de Agendamento
O aplicativo agendará automaticamente a execução com base nas configurações de cronograma armazenadas na tabela app_control do banco de dados. Você pode ajustar o cronograma de execução editando o campo cron dessa tabela para um formato de cron válido.

O formato de cron padrão é * * * * *, que representa o agendamento para cada minuto. Você pode modificar esse formato para agendar a execução em intervalos específicos.

Funcionamento
O aplicativo funciona da seguinte forma:

Verifica periodicamente se existem arquivos CSV na pasta downloads.

Se houver arquivos na pasta, ele processa cada arquivo CSV, realizando cálculos e filtrando informações.

Com base nas informações processadas, ele verifica se é necessário enviar e-mails para determinados usuários.

Se houver usuários que precisam receber e-mails, o aplicativo envia os e-mails e registra o envio no banco de dados.

O aplicativo atualiza a data de próxima execução com base no cronograma armazenado no banco de dados.

Os arquivos processados são movidos da pasta downloads para a pasta processado.

O aplicativo continua em execução, aguardando novos arquivos na pasta downloads e realizando as ações acima periodicamente.

Considerações Finais
O Disparador de E-mails é uma ferramenta poderosa para monitorar o espaço em disco de contas de e-mail e notificar os usuários quando o espaço utilizado está se aproximando do limite. Com a configuração de agendamento flexível, você pode ajustar facilmente o cronograma de execução para atender às suas necessidades específicas.

Certifique-se de monitorar os logs de execução e os erros registrados no banco de dados para garantir que o aplicativo esteja funcionando corretamente.



exec python

Documentação do Código Python - Email Downloader

Este documento fornece informações sobre as bibliotecas Python necessárias para executar o código email_downloader.py e como executá-lo corretamente.

1. Bibliotecas Necessárias:

Certifique-se de ter as seguintes bibliotecas instaladas antes de executar o código:

imaplib: Biblioteca para acessar e interagir com servidores de email através do protocolo IMAP.
email: Biblioteca para trabalhar com mensagens de email.
os: Biblioteca para interagir com o sistema operacional, permitindo acessar variáveis de ambiente.
dotenv: Biblioteca para carregar variáveis de ambiente a partir de um arquivo .env.
2. Instalação das Bibliotecas:

Se você não tiver as bibliotecas instaladas, você pode instalá-las manualmente usando o pip, o gerenciador de pacotes padrão do Python. Abra o prompt de comando ou terminal e execute o seguinte comando:

Copy code
pip install imaplib email dotenv
3. Configuração das Credenciais:

Para executar o código corretamente, é necessário configurar as credenciais de acesso ao seu email. Crie um arquivo chamado .env na mesma pasta do arquivo email_downloader.py e adicione as seguintes linhas:

makefile
Copy code
EMAIL_USER=sua_conta_de_email
EMAIL_PASSWORD=sua_senha_de_email
Substitua sua_conta_de_email pela sua conta de email e sua_senha_de_email pela senha correspondente. Essas variáveis serão carregadas pelo código usando a biblioteca dotenv.

4. Executando o Código:

Após a instalação das bibliotecas e a configuração das credenciais, você pode executar o código email_downloader.py. Abra o prompt de comando ou terminal e navegue até a pasta que contém o arquivo email_downloader.py. Em seguida, execute o seguinte comando:

Copy code
python email_downloader.py
O código irá se conectar à sua caixa de entrada de email, listar todos os emails disponíveis e baixar os anexos para a pasta download na raiz do projeto.

Observação: Certifique-se de que o Python esteja instalado corretamente no seu sistema e que o comando python seja reconhecido pelo prompt de comando ou terminal. Se você estiver usando um ambiente virtual, ative-o antes de executar o código.

Com essas etapas concluídas, o código deverá funcionar corretamente e realizar o download dos anexos dos emails da sua caixa de entrada.