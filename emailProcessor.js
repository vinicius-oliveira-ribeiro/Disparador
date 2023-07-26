const Imap = require('imap');
const fs = require('fs');
const dotenv = require('dotenv');
const MailParser = require('mailparser').MailParser;
const path = require('path'); // Importar o módulo path para lidar com caminhos

dotenv.config();

// Configuração do servidor IMAP
const imapConfig = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: 'imap-mail.outlook.com',
  port: 993,
  tls: true,
};

console.log('Conectando ao servidor de e-mail...');

const imap = new Imap(imapConfig);

// Função para abrir a caixa de entrada
function openInbox(cb) {
  imap.openBox('INBOX', true, cb);
}

// Evento disparado quando a conexão com o servidor IMAP estiver pronta
imap.once('ready', () => {
  console.log('Conexão bem-sucedida. Buscando e-mails...');

  openInbox((err, box) => {
    if (err) {
      console.error('Erro ao abrir a caixa de entrada:', err);
      return;
    }

    // Critério de busca para encontrar e-mails não lidos
    const searchCriteria = ['UNSEEN'];

    // Busca por e-mails não lidos
    imap.search(searchCriteria, (searchErr, messages) => {
      if (searchErr) {
        console.error('Erro ao buscar e-mails não lidos:', searchErr);
        imap.end();
        return;
      }

      // Verifica se nenhum e-mail não lido foi encontrado
      if (messages.length === 0) {
        console.log('Nenhum e-mail não lido encontrado.');
        imap.end();
        return;
      }

      const messageCount = messages.length;

      console.log(`Encontrado(s) ${messageCount} e-mail(s) não lido(s). Fazendo o download do(s) anexo(s)...`);

      // Processa cada e-mail não lido
      messages.forEach((messageUID, index) => {
        const fetchTask = imap.fetch(messageUID, { bodies: '' });

        fetchTask.on('message', (msg, seqNumber) => {
          const mailParser = new MailParser();

          console.log(`Iniciando o download do e-mail com UID ${seqNumber}...`);

          // Evento disparado quando o cabeçalho de um e-mail é processado
          mailParser.on('headers', (headers) => {
            console.log('Título:', headers.get('subject')); // Exibir o assunto do e-mail
            console.log('Remetente:', headers.get('from')); // Exibir o remetente do e-mail
            console.log('Destinatário:', headers.get('to')); // Exibir o destinatário do e-mail
          });

          // Evento disparado quando o corpo do e-mail é processado
          mailParser.on('data', (data) => {
            if (data.type === 'text') {
              console.log('Corpo:', data.text); // Exibir o corpo de texto do e-mail (somente texto)
            } else if (data.type === 'html') {
              console.log('Corpo (HTML):', data.html); // Exibir o corpo de texto do e-mail (HTML)
            }
          });

          msg.on('body', (stream, info) => {
            stream.pipe(mailParser);
          });

          // Evento disparado quando um anexo é encontrado
          mailParser.on('attachment', (attachment, mail) => {
            const filename = attachment.filename;
            const fullFilePath = path.join(__dirname, 'src', 'downloads', filename); // Caminho corrigido
            const fileStream = fs.createWriteStream(fullFilePath);

            attachment.content.pipe(fileStream);

            fileStream.on('finish', () => {
              console.log(`Arquivo ${filename} salvo na pasta de downloads.`);
              if (index === messageCount - 1) {
                imap.end();
              }
            });
          });

          // Evento disparado quando ocorre um erro ao fazer o download do anexo
          mailParser.on('error', (err) => {
            console.error(`Erro ao fazer o download do anexo do e-mail com UID ${seqNumber}:`, err);
          });
        });

        // Evento disparado quando ocorre um erro ao buscar o e-mail
        fetchTask.once('error', (fetchErr) => {
          console.error('Erro ao fazer o download do e-mail:', fetchErr);
          imap.end();
        });
      });
    });
  });
});

// Evento disparado quando ocorre um erro ao se conectar ao servidor IMAP
imap.once('error', (err) => {
  console.error('Erro ao se conectar ao servidor de e-mail:', err);
});

// Evento disparado quando a conexão com o servidor IMAP é encerrada
imap.once('end', () => {
  console.log('Conexão com o servidor de e-mail encerrada.');
});

// Inicia a conexão com o servidor de e-mail
imap.connect();
