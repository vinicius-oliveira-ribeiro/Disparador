import imaplib
import email
import os
import json
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2 import sql

# Carregar as variáveis de ambiente do arquivo .env
load_dotenv()

# Configuração do servidor IMAP
imap_server = 'imap-mail.outlook.com'  # Servidor IMAP do Outlook
imap_user = os.environ.get('EMAIL_USER')
imap_password = os.environ.get('EMAIL_PASS')

# Conectar ao servidor IMAP
imap = imaplib.IMAP4_SSL(imap_server)
imap.login(imap_user, imap_password)

# Selecionar a caixa de entrada (INBOX)
imap.select('INBOX')

# Buscar todos os e-mails na caixa de entrada
status, messages = imap.search(None, 'ALL')
message_ids = messages[0].split()

# Lista para armazenar os e-mails com o assunto "Test"
emails_list = []

# Função para salvar o anexo de um e-mail
def salvar_anexo(msg, pasta_download):
    for part in msg.walk():
        if part.get_content_maintype() == 'multipart':
            continue
        if part.get('Content-Disposition') is None:
            continue

        nome_arquivo = part.get_filename()
        if nome_arquivo is not None:
            caminho_arquivo = os.path.join(pasta_download, nome_arquivo)
            with open(caminho_arquivo, 'wb') as f:
                f.write(part.get_payload(decode=True))
            print(f'Arquivo {nome_arquivo} salvo na pasta de downloads.')

# Criar a pasta de downloads (se ainda não existir)
pasta_download = 'src/downloads'
if not os.path.exists(pasta_download):
    os.makedirs(pasta_download)

# Conectar ao banco de dados PostgreSQL
url_banco_dados = os.environ.get('DB_URL')
conn = psycopg2.connect(url_banco_dados)
cursor = conn.cursor()

# Processar cada e-mail na caixa de entrada
for id_mensagem in message_ids:
    res, dados_msg = imap.fetch(id_mensagem, '(RFC822)')
    if res == 'OK':
        mensagem_email = email.message_from_bytes(dados_msg[0][1])

        # Verificar se o assunto do e-mail é "Test"
        if mensagem_email.get('Subject') == "Test":
            # Extrair informações do e-mail
            informacao_email = {
                "De": mensagem_email.get('From'),
                "Para": mensagem_email.get('To'),
                "Assunto": mensagem_email.get('Subject'),
                "Data": mensagem_email.get('Date'),
                "Conteudo": {}
            }

            # Verificar se o e-mail tem anexo
            if mensagem_email.get_content_maintype() == 'multipart':
                salvar_anexo(mensagem_email, pasta_download)

            # Adicionar conteúdo do e-mail ao dicionário
            for parte in mensagem_email.walk():
                tipo_conteudo = parte.get_content_type()
                corpo_conteudo = parte.get_payload(decode=True)

                # Verificar se o conteúdo não é nulo e não é do tipo "multipart" ou "multipart/alternative"
                if corpo_conteudo and tipo_conteudo not in ["multipart", "multipart/alternative"]:
                    informacao_email["Conteudo"][tipo_conteudo] = corpo_conteudo.decode('utf-8')

            emails_list.append(informacao_email)

# Fechar a conexão com o servidor IMAP
imap.logout()

# Ordenar a lista de e-mails por data (do mais recente para o mais antigo)
emails_list.sort(key=lambda x: datetime.strptime(x['Data'], '%a, %d %b %Y %H:%M:%S %z'), reverse=True)

# Obter o e-mail mais recente
email_mais_recente = emails_list[0]

# Converter a data e hora do e-mail mais recente para formato de data e hora do banco de dados
data_hora_email_mais_recente = datetime.strptime(email_mais_recente['Data'], '%a, %d %b %Y %H:%M:%S %z').strftime('%Y-%m-%d %H:%M:%S')

# Atualizar a data e hora de recebimento de e-mails no banco de dados
atualizar_query = sql.SQL('''
    UPDATE public.app_control
    SET email_receipt_date = %s
    WHERE app_name = %s
''')
cursor.execute(atualizar_query, [data_hora_email_mais_recente, 'disparador_de_email'])
conn.commit()

# Fechar a conexão com o banco de dados
cursor.close()
conn.close()
