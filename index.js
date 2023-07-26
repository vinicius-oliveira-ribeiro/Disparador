const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const cron = require('node-cron');
const dotenv = require('dotenv');
const { format, differenceInDays, parseISO } = require('date-fns');

dotenv.config(); // Load environment variables from .env file

const timeZone = 'America/Sao_Paulo';

// Função para registrar erros na tabela error_log
async function logError(errorType, errorMessage) {
  try {
    const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    const query = `
      INSERT INTO public.error_log (error_type, error_message, occurred_at)
      VALUES ($1, $2, $3)
    `;
    const values = [errorType, errorMessage, new Date()];

    await pool.query(query, values);
    pool.end();
  } catch (error) {
    console.error('Erro ao registrar erro no banco de dados:', error);
  }
}

// Função para ler e processar o arquivo CSV
async function processCSVFile(csvFilePath) {
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
              // Registra o erro na tabela de erros
              logError('Erro de envio de e-mail', error.message);
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
          // Registra o erro na tabela de erros
          logError('Erro de conexão ao banco de dados', error.message);
        } finally {
          // Close the pool when all emails are sent
          pool.end();
        }
      } else {
        console.log("Nenhum objeto atende à condição: 'Storage Used (GB)' >= 40GB (80% de 50GB).");
      }
    });
}

// Função para mover um arquivo de uma pasta para outra
function moveFile(sourcePath, destinationPath) {
  fs.renameSync(sourcePath, destinationPath);
}

// Função para ler e processar um arquivo CSV na pasta processar
async function processFileInFolder(folderPath) {
  // Lista os arquivos na pasta
  const files = fs.readdirSync(folderPath);

  // Verifica se há arquivos na pasta
  if (files.length === 0) {
    console.log(`Não há arquivos na pasta ${folderPath}. Aguardando novos arquivos...`);
    return;
  }

  // Assume que haverá apenas um arquivo na pasta
  const csvFilePath = path.join(folderPath, files[0]);

  console.log(`Iniciando leitura e processamento do arquivo CSV ${csvFilePath}...`);
  await processCSVFile(csvFilePath);
  console.log(`Arquivo CSV ${csvFilePath} processado com sucesso.`);

  // Move o arquivo processado para a pasta de processado
  const processedFolderPath = path.join(__dirname, 'processado');
  moveFile(csvFilePath, path.join(processedFolderPath, files[0]));

  console.log(`Arquivo CSV movido para a pasta ${processedFolderPath}.`);
}

// Função para verificar e processar os arquivos na pasta processar
async function processFilesInProcessFolder() {
  const processFolderPath = path.join(__dirname, 'processar');
  const files = fs.readdirSync(processFolderPath);

  // Verifica se há arquivos na pasta
  if (files.length === 0) {
    console.log(`Não há arquivos para processar na pasta ${processFolderPath}. Aguardando novos arquivos...`);
    return;
  }

  console.log(`Iniciando processamento dos arquivos na pasta ${processFolderPath}...`);
  for (const file of files) {
    const filePath = path.join(processFolderPath, file);
    await processCSVFile(filePath);
    console.log(`Arquivo ${file} processado com sucesso.`);

    // Move o arquivo processado para a pasta de processado
    const processedFolderPath = path.join(__dirname, 'processado');
    moveFile(filePath, path.join(processedFolderPath, file));

    console.log(`Arquivo ${file} movido para a pasta ${processedFolderPath}.`);
  }
}


// Função para agendar a execução do processo de leitura e processamento
function scheduleProcess(cronSchedule) {
  // Executa a função para processar arquivos na pasta processar, se houver
  processFilesInProcessFolder();

  // Executa a função para ler e processar o arquivo CSV em downloads, se houver
  const downloadsFolderPath = path.join(__dirname, 'downloads');
  processFileInFolder(downloadsFolderPath);
}

// Executa o processo de leitura e processamento no início
scheduleProcess();

// Obter a configuração de agendamento do banco de dados e atualizar a execução
async function updateExecutionSchedule() {
  try {
    const pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    const query = `
      SELECT * FROM public.app_control WHERE app_name = $1
    `;
    const values = ['disparador_de_email'];

    const result = await pool.query(query, values);
    const schedule = result.rows[0];

    if (schedule) {
      const cronExpression = schedule.cron ? schedule.cron : '*/3 * * * *'; // A cada 3 minutos (para fins de demonstração)
      cron.schedule(cronExpression, () => {
        scheduleProcess(cronExpression);
      });
      console.log('Agendamento de tarefa configurado com sucesso:', cronExpression);
    } else {
      console.log('Nenhuma configuração de agendamento encontrada para disparador_de_email.');
    }

    pool.end();
  } catch (error) {
    console.error('Erro ao atualizar informações de execução no banco de dados:', error);
  }
}

// Agendamento para verificar e atualizar o cron de execução a cada minuto
cron.schedule('* * * * *', () => {
  updateExecutionSchedule();
});
