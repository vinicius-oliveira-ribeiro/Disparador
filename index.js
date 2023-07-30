const path = require('path');
const csv = require('csv-parser');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const cron = require('node-cron');
const dotenv = require('dotenv');
const shell = require('shelljs');

dotenv.config();

// Instalar as dependências Python (python-dotenv)
console.log('Instalando python-dotenv...');
shell.exec('py -m pip install python-dotenv', (code, stdout, stderr) => {
  if (code !== 0) {
    console.error(`Erro ao instalar python-dotenv: ${stderr}`);
    process.exit(1);
  }

  console.log('python-dotenv instalado com sucesso.');

  // Após instalar o python-dotenv, podemos continuar com o restante do código.
  main();
});

// Função principal que inicia a execução após a instalação do python-dotenv
async function main() {
  const timeZone = 'America/Sao_Paulo';

  // Configuração do transporte de e-mail (nodemailer)
  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', // Microsoft 365 SMTP server
    port: 587,
    secure: false, // Connection is not secure since the port is 587
    auth: {
      user: process.env.EMAIL_USER, // Use your email address here
      pass: process.env.EMAIL_PASS, // Use your email password here
    },
  });

  // Função para logar erros na tabela error_log
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

  // Função para ler e processar o arquivo CSV
  async function processCSVFile(csvFilePath) {
    const jsonArray = [];

    console.log('Iniciando leitura do arquivo CSV...');

    fs.createReadStream(csvFilePath)
      .pipe(csv({ separator: ';' }))
      .on('data', (data) => {
        jsonArray.push(data);
      })
      .on('end', async () => {
        console.log('Leitura do arquivo CSV concluída.');

        jsonArray.forEach((obj) => {
          if (obj['Storage Used (Byte)']) {
            const bytes = parseFloat(obj['Storage Used (Byte)']);
            const gigabytes = bytes / (1024 * 1024 * 1024);
            obj['Storage Used (GB)'] = gigabytes.toFixed(2);
          }
        });

        const filteredArray = jsonArray.filter((obj) => {
          return obj['Storage Used (GB)'] >= 40;
        });

        if (filteredArray.length > 0) {
          console.log('Iniciando envio de e-mails...');

          async function sendEmailWithDelay(index, client) {
            if (index < filteredArray.length) {
              const obj = filteredArray[index];
              const email = obj['User Principal Name'];

              const checkEmailQuery = `
                SELECT status FROM public.envio_de_email WHERE email = $1
              `;
              const checkEmailValues = [email];
              const result = await client.query(checkEmailQuery, checkEmailValues);

              if (result.rows.length > 0 && result.rows[0].status === 'sent') {
                console.log(`E-mail ${email} já foi enviado. Nada a Fazer.`);
                sendEmailWithDelay(index + 1, client);
                return;
              }

              const currentDate = new Date();
              const nextDay = new Date(currentDate);
              nextDay.setDate(currentDate.getDate() + 1);
              const formattedDate = `${nextDay.getDate()}/${nextDay.getMonth() + 1}/${nextDay.getFullYear()}`;
              const clientName = obj['Display Name'];
              const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Dados filtrados do JSON',
                text: `
                  Olá, ${clientName}, notamos que o limite de espaço em disco do seu e-mail está se aproximando. 
                  Agendamos uma limpeza para o dia ${formattedDate}.
                  Atenciosamente, Gabriel Rocha`,
              };

              try {
                const info = await transporter.sendMail(mailOptions);
                console.log('E-mail enviado:', info.response);
                console.log('URL do E-mail Ethereal:', nodemailer.getTestMessageUrl(info));

                const saveEmailQuery = `
                  INSERT INTO public.envio_de_email (email, status, create_date, modified_date)
                  VALUES ($1, $2, $3, $4)
                `;
                const values = [email, 'sent', new Date(), new Date()];
                await client.query(saveEmailQuery, values);
              } catch (error) {
                console.log('Ocorreu um erro ao enviar o e-mail:', error);
                logError('envio_de_email', error.message);
              }

              setTimeout(() => {
                sendEmailWithDelay(index + 1, client);
              }, 4000);
            } else {
              client.release();
            }
          }

          const pool = new Pool({
            connectionString: process.env.DB_URL,
            ssl: {
              rejectUnauthorized: false,
            },
          });

          try {
            const client = await pool.connect();
            sendEmailWithDelay(0, client);
            console.log('Envio de e-mails concluído.');
          } catch (error) {
            console.error('Erro ao conectar ao banco de dados:', error);
            logError('conexão_bd', error.message);
          } finally {
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

  // Função para ler e processar um arquivo CSV na pasta 'processar'
  async function processFileInFolder(folderPath) {
    const files = fs.readdirSync(folderPath);

    if (files.length === 0) {
      console.log(`Não há arquivos na pasta ${folderPath}. Aguardando novos arquivos...`);
      return;
    }

    const csvFilePath = path.join(folderPath, files[0]);

    console.log(`Iniciando leitura e processamento do arquivo CSV ${csvFilePath}...`);
    await processCSVFile(csvFilePath);
    console.log(`Arquivo CSV ${csvFilePath} processado com sucesso.`);

    const processedFolderPath = path.join(__dirname, 'src/processado');
    moveFile(csvFilePath, path.join(processedFolderPath, files[0]));

    console.log(`Arquivo CSV movido para a pasta ${processedFolderPath}.`);
  }

  // Função para verificar e processar os arquivos na pasta 'processar'
  async function processFilesInProcessFolder() {
    const processFolderPath = path.join(__dirname, 'src/processar');
    const files = fs.readdirSync(processFolderPath);

    if (files.length === 0) {
      console.log(`Não há arquivos para processar na pasta ${processFolderPath}. Aguardando novos arquivos...`);
      return;
    }

    console.log(`Iniciando processamento dos arquivos na pasta ${processFolderPath}...`);
    for (const file of files) {
      const filePath = path.join(processFolderPath, file);
      await processCSVFile(filePath);
      console.log(`Arquivo ${file} processado com sucesso.`);

      const processedFolderPath = path.join(__dirname, 'src/processado');
      moveFile(filePath, path.join(processedFolderPath, file));

      console.log(`Arquivo ${file} movido para a pasta ${processedFolderPath}.`);
    }
  }

  // Função para agendar a execução do processo
  function scheduleProcess(cronSchedule) {
    processFilesInProcessFolder();
    const downloadsFolderPath = path.join(__dirname, 'src/downloads');
    processFileInFolder(downloadsFolderPath);
  }

  // Agendar a execução do processo no início
  scheduleProcess();

  // Obter a configuração do agendamento de execução do banco de dados e atualizar a execução
  async function updateExecutionSchedule() {
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

  // Agendar para verificar e atualizar o cron de execução a cada minuto
  cron.schedule('* * * * *', () => {
    updateExecutionSchedule();
  });
}
