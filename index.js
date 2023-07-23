const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

const csvFilePath = path.join(__dirname, 'dados_csv', 'meuCSV.csv');

dotenv.config(); // Carrega as variáveis de ambiente do .env

const jsonArray = [];

console.log('Iniciando leitura do arquivo CSV...');

fs.createReadStream(csvFilePath)
  .pipe(csv({ separator: ';' })) // Defina o separador como ponto e vírgula
  .on('data', (data) => {
    jsonArray.push(data);
  })
  .on('end', async () => {
    console.log('Leitura do arquivo CSV concluída.');
    // Converta 'Storage Used (Byte)' para gigabytes para cada objeto no array
    jsonArray.forEach((obj) => {
      if (obj['Storage Used (Byte)']) {
        const bytes = parseFloat(obj['Storage Used (Byte)']);
        const gigabytes = bytes / (1024 * 1024 * 1024); // 1 gigabyte = 1024 MB = 1024 * 1024 KB = 1024 * 1024 * 1024 bytes
        obj['Storage Used (GB)'] = gigabytes.toFixed(2); // Adicionando novo campo com o valor convertido
      }
    });

    // Filtrar os objetos onde 'Storage Used (GB)' atinge 80% de 50GB (40GB)
    const filteredArray = jsonArray.filter((obj) => {
      return obj['Storage Used (GB)'] >= 40;
    });

    if (filteredArray.length > 0) {
      console.log('Iniciando envio de e-mails...');
      const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com', // Servidor SMTP do Microsoft 365
        port: 587,
        secure: false, // A conexão não é segura, pois o porto é 587
        auth: {
          user: process.env.EMAIL_USER, // Use o seu e-mail aqui
          pass: process.env.EMAIL_PASS, // Use a senha do seu e-mail aqui
        },
      });

      filteredArray.forEach((obj) => {
        // Get the current date
        const currentDate = new Date();

        // Add one day to the current date
        const nextDay = new Date(currentDate);
        nextDay.setDate(currentDate.getDate() + 1);

        // Format the date in the desired format (dd/mm/yyyy)
        const formattedDate = `${nextDay.getDate()}/${nextDay.getMonth() + 1}/${nextDay.getFullYear()}`;
        const clinteName = obj['Display Name'];
        const mailOptions = {
          from: process.env.EMAIL_USER, // Use o seu endereço de e-mail aqui
          to: obj['User Principal Name'], // Use 'User Principal Name' como o destinatário do e-mail
          subject: 'Dados filtrados do JSON',
          text: `
            Olá, ${clinteName}, notamos que o limite de espaço em disco do seu e-mail está se aproximando. 
            Agendamos uma limpeza para o dia ${formattedDate}.
            
            Atenciosamente, Gabriel Rocha`, // Modifique o corpo do e-mail para incluir o texto e a data
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log('Ocorreu um erro ao enviar o e-mail:', error);
          } else {
            console.log('E-mail enviado:', info.response);
            console.log('URL do E-mail Ethereal:', nodemailer.getTestMessageUrl(info));
          }
        });
      });

      console.log('Envio de e-mails concluído.');
    } else {
      console.log("Nenhum objeto atende à condição: 'Storage Used (GB)' >= 40GB (80% de 50GB).");
    }
  });
