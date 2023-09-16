const nodemailer = require('nodemailer');
const cron = require('node-cron');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const timeZone = 'America/Sao_Paulo';

// Configuração do transporte de e-mail
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Função para enviar e-mails de aniversário
async function enviarEmailAniversario() {
  try {
    const pool = new Pool({
      connectionString: process.env.DB_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesAtual = hoje.getMonth() + 1;
    const dataHoje = `${hoje.getFullYear()}-${mesAtual.toString().padStart(2, '0')}-${diaAtual.toString().padStart(2, '0')}`;

    // Consulta os aniversariantes de hoje na tabela aniversariantes
    const query = `
      SELECT a.id, a.nome, a.email, a.ultimo_envio, c.corpo_texto
      FROM aniversariantes AS a
      INNER JOIN corpos_email AS c ON a.corpo_email_id = c.id
    `;
    const result = await pool.query(query);
    const aniversariantes = result.rows;

    console.log('Iniciando verificação de aniversariantes...');

    for (const aniversariante of aniversariantes) {
      const { id, nome, email, corpo_texto, ultimo_envio } = aniversariante;
      const dataAniversario = new Date(ultimo_envio);

      // Verifica se já se passou um ano desde o último envio de e-mail
      if (hoje.getMonth() === dataAniversario.getMonth() && hoje.getDate() === dataAniversario.getDate()) {
        console.log(`Enviando e-mail de aniversário para ${email}...`);

        const corpoEmailPersonalizado = corpo_texto
          .replace('{{nome}}', nome)
          .replace('{{data_aniversario}}', dataHoje);

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Feliz Aniversário! 🥳🎉🎂',
          html: corpoEmailPersonalizado,
        };

        try {
          const info = await transporter.sendMail(mailOptions);
          console.log(`E-mail enviado para ${email}: ${info.response}`);

          // Atualiza a data de último envio com a data atual
          const updateQuery = `
            UPDATE aniversariantes SET ultimo_envio = $2 WHERE id = $1
          `;
          const updateValues = [id, hoje];
          await pool.query(updateQuery, updateValues);
        } catch (error) {
          console.error(`Erro ao enviar e-mail para ${email}: ${error.message}`);
        }
      }
    }

    console.log('Verificação de aniversariantes concluída.');

    pool.end();
  } catch (error) {
    console.error('Erro ao verificar aniversariantes:', error.message);
  }
}

// Agendar a execução diária para verificar e enviar e-mails de aniversário às 9h da manhã
/* cron.schedule('0 9 * * *', () => {
  enviarEmailAniversario();
}, {
  timezone: timeZone
});
 */

enviarEmailAniversario();
