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

# Buscar todos os e-mails na caixa de entrada
status, messages = imap.search(None, 'ALL')
message_ids = messages[0].split()

# Lista para armazenar os e-mails com o assunto "Test"
emails_list = []

# Função para salvar o anexo de um e-mail
def save_attachment(msg, download_folder):
    for part in msg.walk():
        if part.get_content_maintype() == 'multipart':
            continue
        if part.get('Content-Disposition') is None:
            continue

        filename = part.get_filename()
        if filename is not None:
            filepath = os.path.join(download_folder, filename)
            with open(filepath, 'wb') as f:
                f.write(part.get_payload(decode=True))
            print(f'Arquivo {filename} salvo na pasta de downloads.')

# Criar a pasta de downloads (se ainda não existir)
download_folder = 'src/downloads'
if not os.path.exists(download_folder):
    os.makedirs(download_folder)

# Processar cada e-mail na caixa de entrada
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
emails_list.sort(key=lambda x: datetime.strptime(x['Date'], '%a, %d %b %Y %H:%M:%S %z'), reverse=True)

# Obter o e-mail mais recente
most_recent_email = emails_list[0]

# Converter a data e hora do e-mail para o fuso horário correto (UTC-3, horário de Brasília)
timezone_br = pytz.timezone('America/Sao_Paulo')
email_date = datetime.strptime(most_recent_email['Date'], '%a, %d %b %Y %H:%M:%S %z').astimezone(timezone_br)

# Formatar a data e hora para o padrão desejado (ano-mês-dia hora:minuto:segundo)
formatted_email_date = email_date.strftime('%Y-%m-%d %H:%M:%S')

# Conectar ao banco de dados PostgreSQL
url_banco_dados = os.environ.get('DB_URL')
conn = psycopg2.connect(url_banco_dados)
cursor = conn.cursor()

# Atualizar a data e hora de recebimento de e-mails no banco de dados
atualizar_query = sql.SQL('''
    UPDATE public.app_control
    SET email_receipt_date = %s
    WHERE app_name = %s
''')
cursor.execute(atualizar_query, [formatted_email_date, 'disparador_de_email'])
conn.commit()

# Fechar a conexão com o banco de dados
cursor.close()
conn.close()
