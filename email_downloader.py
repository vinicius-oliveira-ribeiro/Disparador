import imaplib
import email
import os
import json
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2 import sql
import pytz

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

# Lista para armazenar os e-mails com o assunto "Test"
emails_list = []

# Função para salvar o anexo de um e-mail com o nome tratado
def save_attachment(msg, download_folder):
    for part in msg.walk():
        if part.get_content_maintype() == 'multipart':
            continue
        if part.get('Content-Disposition') is None:
            continue

        filename = part.get_filename()
        if filename is not None:
            # Tratar o nome do arquivo para lowercase e adicionar a data no formato "yyyymmdd"
            file_basename, file_extension = os.path.splitext(filename)
            treated_filename = f"{file_basename.lower()}_{datetime.now().strftime('%Y%m%d')}{file_extension}"

            filepath = os.path.join(download_folder, treated_filename)
            with open(filepath, 'wb') as f:
                f.write(part.get_payload(decode=True))
            print(f'Arquivo {treated_filename} salvo na pasta de downloads.')

# Criar a pasta de downloads (se ainda não existir)
download_folder = 'src/downloads'
if not os.path.exists(download_folder):
    os.makedirs(download_folder)

# Conectar ao banco de dados PostgreSQL
url_banco_dados = os.environ.get('DB_URL')
conn = psycopg2.connect(url_banco_dados)
cursor = conn.cursor()

# Obter a data salva na coluna "email_receipt_date" da tabela "app_control"
get_date_query = """
    SELECT email_receipt_date FROM public.app_control
    WHERE app_name = %s
    ORDER BY id DESC
    LIMIT 1;
"""
cursor.execute(get_date_query, ['disparador_de_email'])
result = cursor.fetchone()
email_receipt_date = result[0] if result else None

# Processar cada e-mail na caixa de entrada
status, messages = imap.search(None, 'ALL')
message_ids = messages[0].split()
for message_id in message_ids:
    res, msg_data = imap.fetch(message_id, '(RFC822)')
    if res == 'OK':
        email_message = email.message_from_bytes(msg_data[0][1])

        # Verificar se o assunto do e-mail é "Test"
        if email_message.get('Subject') == "Test":
            # Extrair informações do e-mail
            email_info = {
                "From": email_message.get('From'),
                "To": email_message.get('To'),
                "Subject": email_message.get('Subject'),
                "Date": email_message.get('Date'),
                "Content": {}
            }

            # Verificar se o e-mail tem anexo
            if email_message.get_content_maintype() == 'multipart':
                # Verificar se a data do e-mail é maior que a data salva
                email_date_str = email_info["Date"]
                email_date = datetime.strptime(email_date_str, '%a, %d %b %Y %H:%M:%S %z').astimezone(pytz.UTC)
                if email_receipt_date is None or email_date > email_receipt_date.replace(tzinfo=pytz.UTC):
                    save_attachment(email_message, download_folder)

            # Adicionar conteúdo do e-mail ao dicionário
            for part in email_message.walk():
                content_type = part.get_content_type()
                content_body = part.get_payload(decode=True)

                # Verificar se o conteúdo não é nulo e não é do tipo "multipart" ou "multipart/alternative"
                if content_body and content_type not in ["multipart", "multipart/alternative"]:
                    email_info["Content"][content_type] = content_body.decode('utf-8')

            emails_list.append(email_info)

# Fechar a conexão com o servidor IMAP
imap.logout()

# Ordenar a lista de e-mails por data (do mais recente para o mais antigo)
emails_list.sort(key=lambda x: datetime.strptime(x['Date'], '%a, %d %b %Y %H:%M:%S %z').astimezone(pytz.UTC), reverse=True)

# Obter o e-mail mais recente
most_recent_email = emails_list[0]

# Extrair a data de recebimento do e-mail mais recente
most_recent_email_date_str = most_recent_email["Date"]
most_recent_email_date = datetime.strptime(most_recent_email_date_str, '%a, %d %b %Y %H:%M:%S %z').astimezone(pytz.UTC)

# Salvar a data de recebimento na coluna "email_receipt_date" da tabela "app_control"
save_date_query = """
    UPDATE public.app_control
    SET email_receipt_date = %s
    WHERE app_name = %s
"""
cursor.execute(save_date_query, (most_recent_email_date, 'disparador_de_email'))
conn.commit()

# Fechar a conexão com o banco de dados
cursor.close()
conn.close()
