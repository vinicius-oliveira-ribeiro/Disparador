const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');

const csvFilePath = path.join(__dirname, 'dados_csv', 'meuCSV.csv');

const jsonArray = [];

fs.createReadStream(csvFilePath)
  .pipe(csv({ separator: ';' })) // Set the separator to semicolon
  .on('data', (data) => {
    jsonArray.push(data);
  })
  .on('end', async () => {
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
      // Get Ethereal test account credentials
      const testAccount = await nodemailer.createTestAccount();

      // Sending the filtered JSON data via email for each object that meets the condition
      const transporter = nodemailer.createTransport(smtpTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: testAccount.user, // Use the Ethereal email address as the 'from' field
          pass: testAccount.pass, // Use the Ethereal email password
        },
      }));

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
          from: testAccount.user, // Use the Ethereal email address as the 'from' field
          to: obj['User Principal Name'], // Use 'User Principal Name' as the recipient's email address
          subject: 'Filtered JSON Data',
          text: `Deu certo ${formattedDate} ${clinteName}`, // Modify the email body to include the text and date
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log('Error occurred while sending email:', error);
          } else {
            console.log('Email sent:', info.response);
            console.log('Ethereal Email URL:', nodemailer.getTestMessageUrl(info));
          }
        });
      });
    } else {
      console.log("No objects meet the condition: 'Storage Used (GB)' >= 40GB (80% of 50GB).");
    }
  });
