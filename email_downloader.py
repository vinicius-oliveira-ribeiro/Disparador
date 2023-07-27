import imaplib
import email
import os
from dotenv import load_dotenv

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

# Buscar todos os e-mails na caixa de entrada com o assunto "Test"
status, messages = imap.search(None, '(SUBJECT "Test")')
message_ids = messages[0].split()

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
            return  # Retorna após encontrar o primeiro anexo

# Criar a pasta de downloads (se ainda não existir)
download_folder = 'src/downloads'
if not os.path.exists(download_folder):
    os.makedirs(download_folder)

# Processar o primeiro e-mail encontrado com o assunto "Test"
for message_id in message_ids:
    res, msg_data = imap.fetch(message_id, '(RFC822)')
    if res == 'OK':
        email_message = email.message_from_bytes(msg_data[0][1])
        save_attachment(email_message, download_folder)
        # Só processamos o primeiro e-mail encontrado com o assunto "Test"
        break

# Fechar a conexão com o servidor IMAP
imap.logout()
