const path = require('path');
const csv = require('csv-parser');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const cron = require('node-cron');
const dotenv = require('dotenv');
const shell = require('shelljs');

dotenv.config();

function installPythonDependencies() {
  console.log('Instalando python-dotenv...');
  shell.exec('py -m pip install python-dotenv', (code, stdout, stderr) => {
    if (code !== 0) {
      console.error(`Erro ao instalar python-dotenv: ${stderr}`);
      process.exit(1);
    }

    console.log('python-dotenv instalado com sucesso.');

    console.log('Executando email_downloader.py...');
    shell.exec('python3.11 email_downloader.py', (code, stdout, stderr) => {
      if (code !== 0) {
        console.error(`Erro ao executar email_downloader.py: ${stderr}`);
        process.exit(1);
      }

      console.log('email_downloader.py executado com sucesso.');
    });
  });
}

const timeZone = 'America/Sao_Paulo';

// Function to log errors in the error_log table
async function logError(errorType, errorMessage) {
  try {
    const pool = new Pool({
      connectionString: process.env.DB_URL,
      ssl: {
        rejectUnauthorized: false,
      },
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

// Function to read and process the CSV file
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
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        // Function to send an email and save it to the database with a 4-second delay
        async function sendEmailWithDelay(index, client) {
          if (index < filteredArray.length) {
            const obj = filteredArray[index];
            const email = obj['User Principal Name'];

            // Check if the email has already been sent by querying the database
            const checkEmailQuery = `
              SELECT status, email_receipt_date FROM public.envio_de_email WHERE email = $1
            `;
            const checkEmailValues = [email];
            const result = await client.query(checkEmailQuery, checkEmailValues);

            const currentDate = new Date();

            if (result.rows.length > 0) {
              const lastSentDate = result.rows[0].email_receipt_date;
              if (lastSentDate && lastSentDate.toDateString() === currentDate.toDateString()) {
                console.log(`E-mail ${email} já foi enviado hoje. Nada a Fazer.`);
                sendEmailWithDelay(index + 1, client); // Move on to the next email
                return;
              }
            }

            const nextDay = new Date(currentDate);
            nextDay.setDate(currentDate.getDate() + 1);
            const formattedDate = `${nextDay.getDate()}/${nextDay.getMonth() + 1}/${nextDay.getFullYear()}`;
            const clientName = obj['Display Name'];
            const clientGbs = obj['Storage Used (GB)'];
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: email,
              subject: 'Dados filtrados do JSON',
              text: `
                Olá, ${clientName}, notamos que o limite de espaço em disco do seu e-mail com um total de ${clientGbs} Gigabytes, dentro de alguns dias,
                seu armazenamento estara lotado em breve. 
                Agendamos uma limpeza para o dia ${formattedDate}.
                Atenciosamente, Gabriel Rocha`,
            };

            try {
              const info = await transporter.sendMail(mailOptions);
              console.log('E-mail enviado:', info.response);
              console.log('URL do E-mail Ethereal:', nodemailer.getTestMessageUrl(info));

              // Save the sent email to the database with the current date
              const saveEmailQuery = `
                INSERT INTO public.envio_de_email (email, status, email_receipt_date, create_date, modified_date)
                VALUES ($1, $2, $3, $4, $5)
              `;
              const values = [email, 'sent', currentDate, new Date(), new Date()];
              await client.query(saveEmailQuery, values);
            } catch (error) {
              console.log('Ocorreu um erro ao enviar o e-mail:', error);
              // Registra o erro na tabela de erros
              console.log('Erro de envio de e-mail', error.message);
              console.log('EmailError', error.message || 'Erro ao enviar o e-mail');
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
          connectionString: process.env.DB_URL,
          ssl: {
            rejectUnauthorized: false,
          },
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
          console.log('Erro de conexão ao banco de dados', error.message);
          console.log('DatabaseError', error.message || 'Erro ao conectar ao banco de dados');
        } finally {
          // Close the pool when all emails are sent
          pool.end();
        }
      } else {
        console.log("Nenhum objeto atende à condição: 'Storage Used (GB)' >= 40GB (80% de 50GB).");
      }
    });
}

// Function to move a file from one folder to another
function moveFile(sourcePath, destinationPath) {
  fs.rename(sourcePath, destinationPath, (err) => {
    if (err) {
      console.error('Erro ao mover o arquivo:', err);
      // Registra o erro na tabela de erros
      console.error('File Moving Error', err.message || err.toString());
    } else {
      console.log(`Arquivo movido de ${sourcePath} para ${destinationPath}.`);
    }
  });
}

// Function to read and process a CSV file in the processar folder
async function processFileInFolder(folderPath) {
  // List the files in the folder
  const files = fs.readdirSync(folderPath);

  // Check if there are files in the folder
  if (files.length === 0) {
    console.log(`Não há arquivos na pasta ${folderPath}. Aguardando novos arquivos...`);
    return;
  }

  // Assume that there will be only one file in the folder
  const csvFilePath = path.join(folderPath, files[0]);

  console.log(`Iniciando leitura e processamento do arquivo CSV ${csvFilePath}...`);
  await processCSVFile(csvFilePath);
  console.log(`Arquivo CSV ${csvFilePath} processado com sucesso.`);

  // Introduce a small delay (1 second) before moving the processed file to avoid conflicts
  setTimeout(() => {
    // Move the processed file to the processado folder
    const processedFolderPath = path.join(__dirname, 'src/processado');
    moveFile(csvFilePath, path.join(processedFolderPath, files[0]));
  }, 1000);
}

// Function to check and process the files in the processar folder
async function processFilesInProcessFolder() {
  const processFolderPath = path.join(__dirname, 'src/processar');
  const files = fs.readdirSync(processFolderPath);

  // Check if there are files in the folder
  if (files.length === 0) {
    console.log(`Não há arquivos para processar na pasta ${processFolderPath}. Aguardando novos arquivos...`);
    return;
  }

  console.log(`Iniciando processamento dos arquivos na pasta ${processFolderPath}...`);
  for (const file of files) {
    const filePath = path.join(processFolderPath, file);
    await processCSVFile(filePath);
    console.log(`Arquivo ${file} processado com sucesso.`);

    // Introduce a small delay (1 second) before moving the processed file to avoid conflicts
    setTimeout(() => {
      // Move the processed file to the processado folder
      const processedFolderPath = path.join(__dirname, 'src/processado');
      moveFile(filePath, path.join(processedFolderPath, file));
      console.log(`Arquivo ${file} movido para a pasta ${processedFolderPath}.`);
    }, 1000);
  }
}

// Function to schedule the execution of the process
function scheduleProcess(cronExpression) {
  cron.schedule(cronExpression, () => {
    // Execute the function to process files in the processar folder, if any
    processFilesInProcessFolder();

    // Execute the function to read and process the CSV file in downloads folder, if any
    const downloadsFolderPath = path.join(__dirname, 'src/downloads');
    processFileInFolder(downloadsFolderPath);

    // Call the function to install Python dependencies and execute email_downloader.py
    installPythonDependencies();
  });
}

// Function to schedule the initial process execution based on the information from the database
async function scheduleInitialProcess() {
  try {
    const pool = new Pool({
      connectionString: process.env.DB_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    const query = `
      SELECT * FROM public.app_control WHERE app_name = $1
    `;
    const values = ['disparador_de_email'];

    const result = await pool.query(query, values);
    const schedule = result.rows[0];

    if (schedule) {
      const cronExpression = schedule.cron ? schedule.cron : '*/3 * * * *'; // A cada 3 minutos (para fins de demonstração)
      scheduleProcess(cronExpression);
      console.log('Agendamento de tarefa configurado com sucesso:', cronExpression);
    } else {
      console.log('Nenhuma configuração de agendamento encontrada para disparador_de_email.');
    }

    pool.end();
  } catch (error) {
    console.error('Erro ao obter informações de execução no banco de dados:', error);
    console.log('DatabaseError', error.message || 'Erro ao obter informações de execução no banco de dados');
  }
}

// Agendar a execução inicial do processo com base nas informações do banco de dados
scheduleInitialProcess();