const si = require('systeminformation');

function getSystemInfo(callback) {
  si.getStaticData((data, error) => {
    if (error) {
      return callback({ error: 'Erro ao obter informações do sistema' });
    }
    
    callback(data);
  });
}

// Exemplo de uso:
getSystemInfo((systemInfo) => {
  console.log(systemInfo);
});
