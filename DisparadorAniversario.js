const nodemailer = require('nodemailer');
const cron = require('node-cron');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const timeZone = 'America/Sao_Paulo';

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
      SELECT id, nome, email, corpo_email, ultimo_envio FROM aniversariantes
    `;
    const result = await pool.query(query);
    const aniversariantes = result.rows;

    console.log('Iniciando verificação de aniversariantes...');

    for (const aniversariante of aniversariantes) {
      const { id, nome, email, corpo_email, ultimo_envio } = aniversariante;
      const dataAniversario = new Date(ultimo_envio); // Converte a data de último envio para um objeto Date

      // Verifica se já se passou um ano desde o último envio de e-mail
      if (hoje.getMonth() === dataAniversario.getMonth() && hoje.getDate() === dataAniversario.getDate()) {
        // Se o mês e o dia de hoje coincidirem com o último envio, então é aniversário novamente
        console.log(`Enviando e-mail de aniversário para ${email}...`);

        const transporter = nodemailer.createTransport({
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const corpoEmailPersonalizado = corpo_email
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