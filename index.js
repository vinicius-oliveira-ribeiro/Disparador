const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const cron = require('node-cron');
const dotenv = require('dotenv');
const { format, differenceInDays, parseISO } = require('date-fns');

dotenv.config(); // Load environment variables from .env file

const scheduledDate = '08:00:00'; // Agendamento diário às 08:00 AM
const timeZone = 'America/Sao_Paulo';

async function sendFilteredEmails() {
  const currentDate = new Date();
  const currentDateString = format(currentDate, "yyyy-MM-dd'T'HH:mm:ss");

  if (currentDate.getDay() !== 1 || currentDate.getHours() >= 8) {
    const nextScheduledDate = parseISO(format(currentDate, "yyyy-MM-dd") + 'T' + scheduledDate, { timeZone });
    if (currentDate.getHours() >= 8) {
      nextScheduledDate.setDate(nextScheduledDate.getDate() + 7);
    }
    const daysLeft = differenceInDays(nextScheduledDate, currentDate);
    console.log('Este código será executado apenas na data agendada.');
    console.log(`Dias faltando para o agendamento: ${daysLeft}`);
    return;
  }

  const csvFilePath = path.join(__dirname, 'dados_csv', 'meuCSV.csv');

  const jsonArray = [];

  console.log('Iniciando leitura do arquivo CSV...');

  fs.createReadStream(csvFilePath)
    .pipe(csv({ separator: ';' })) // Set the separator to semicolon
    .on('data', (data) => {
      jsonArray.push(data);
    })
    .on('end', async () => {
      console.log('Leitura do arquivo CSV concluída.');
      // Convert 'Storage Used (Byte)' to gigabytes for each object in the array
      jsonArray.forEach((obj) => {
        if (obj['Storage Used (Byte)']) {
          const bytes = parseFloat(obj['Storage Used (Byte)']);
          const gigabytes = bytes / (1024 * 1024 * 1024); // 1 gigabyte = 1024 MB = 1024 * 1024 KB = 1024 * 1024 * 1024 bytes
          obj['Storage Used (GB)'] = gigabytes.toFixed(2); // Adding new field with the converted value
        }
      });

      // Filter the objects where 'Storage Used (GB)' reaches 80% of 50GB (40GB)
      const filteredArray = jsonArray.filter((obj) => {
        return obj['Storage Used (GB)'] >= 40;
      });

      if (filteredArray.length > 0) {
        console.log('Iniciando envio de e-mails...');
        const transporter = nodemailer.createTransport({
          host: 'smtp.office365.com', // Microsoft 365 SMTP server
          port: 587,
          secure: false, // Connection is not secure since the port is 587
          auth: {
            user: process.env.EMAIL_USER, // Use your email address here
            pass: process.env.EMAIL_PASS, // Use your email password here
          },
        });

        // Function to send an email and save it to the database with a 4-second delay
        async function sendEmailWithDelay(index, client) {
          if (index < filteredArray.length) {
            const obj = filteredArray[index];
            const email = obj['User Principal Name'];

            // Check if the email has already been sent by querying the database
            const checkEmailQuery = `
              SELECT status FROM public.envio_de_email WHERE email = $1
            `;
            const checkEmailValues = [email];
            const result = await client.query(checkEmailQuery, checkEmailValues);

            if (result.rows.length > 0 && result.rows[0].status === 'sent') {
              console.log(`E-mail ${email} já foi enviado. Nada a Fazer.`);
              sendEmailWithDelay(index + 1, client); // Move on to the next email
              return;
            }

            const currentDate = new Date();
            const nextDay = new Date(currentDate);
            nextDay.setDate(currentDate.getDate() + 1);
            const formattedDate = `${nextDay.getDate()}/${nextDay.getMonth() + 1}/${nextDay.getFullYear()}`;
            const clientName = obj['Display Name'];
            const mailOptions = {
              from: process.env.EMAIL_USER, // Use your email address as the 'from' field
              to: email, // Use 'User Principal Name' as the recipient's email address
              subject: 'Dados filtrados do JSON',
              text: `
                Olá, ${clientName}, notamos que o limite de espaço em disco do seu e-mail está se aproximando. 
                Agendamos uma limpeza para o dia ${formattedDate}.
                Atenciosamente, Gabriel Rocha`, // Modify the email body to include the text and date
            };

            try {
              const info = await transporter.sendMail(mailOptions);
              console.log('E-mail enviado:', info.response);
              console.log('URL do E-mail Ethereal:', nodemailer.getTestMessageUrl(info));

              // Save the sent email to the database
              const saveEmailQuery = `
                INSERT INTO public.envio_de_email (email, status, create_date, modified_date)
                VALUES ($1, $2, $3, $4)
              `;
              const values = [email, 'sent', new Date(), new Date()];
              await client.query(saveEmailQuery, values);

            } catch (error) {
              console.log('Ocorreu um erro ao enviar o e-mail:', error);
            }

            // After sending an email, schedule the next email with a 4-second delay
            setTimeout(() => {
              sendEmailWithDelay(index + 1, client);
            }, 4000); // 4 seconds in milliseconds

          } else {
            client.release(); // Release the client connection
          }
        }

        // Create a connection pool for the PostgreSQL database
        const pool = new Pool({
          user: process.env.DB_USER,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME,
          password: process.env.DB_PASSWORD,
          port: process.env.DB_PORT,
        });

        try {
          // Get a client from the pool
          const client = await pool.connect();

          // Start sending emails with a 4-second delay for each email
          sendEmailWithDelay(0, client);

          console.log('Envio de e-mails concluído.');
        } catch (error) {
          console.error('Erro ao conectar ao banco de dados:', error);
        } finally {
          // Close the pool when all emails are sent
          pool.end();
        }
      } else {
        console.log("Nenhum objeto atende à condição: 'Storage Used (GB)' >= 40GB (80% de 50GB).");
      }
    });
}

// Call the function to start sending filtered emails
sendFilteredEmails();

// Schedule the function to run every Monday at 08:00 AM (Cron expression: '0 8 * * 1')
cron.schedule('0 8 * * 1', () => {
  sendFilteredEmails();
});
