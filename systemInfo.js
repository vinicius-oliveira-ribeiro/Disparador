const si = require('systeminformation');
const os = require('os');
const { Pool } = require('pg');

// Configuração da conexão com o banco de dados
const pool = new Pool({
  connectionString: '',
  ssl: {
    rejectUnauthorized: false,
  },
});

async function generateSystemInfoJSON() {
  try {
    const systemInfo = await si.getStaticData();

    const username = os.userInfo().username;

    const systemInfoJSON = {
      userName: username,
      version: systemInfo.version,
      systemManufacturer: systemInfo.system.manufacturer,
      systemModel: systemInfo.system.model,
      systemVersion: systemInfo.system.version,
      systemSerial: systemInfo.system.serial,
      systemUuid: systemInfo.system.uuid,
      systemSku: systemInfo.system.sku,
      systemVirtual: systemInfo.system.virtual,
      biosVendor: systemInfo.bios.vendor,
      biosVersion: systemInfo.bios.version,
      biosReleaseDate: systemInfo.bios.releaseDate,
      biosRevision: systemInfo.bios.revision,
      biosSerial: systemInfo.bios.serial,
      chassisManufacturer: systemInfo.baseboard.manufacturer,
      chassisModel: systemInfo.baseboard.model,
      chassisType: systemInfo.chassis.type,
      chassisVersion: systemInfo.chassis.version,
      chassisSerial: systemInfo.chassis.serial,
      chassisAssetTag: systemInfo.chassis.assetTag,
      chassisSku: systemInfo.chassis.sku,
      osPlatform: systemInfo.os.platform,
      osDistro: systemInfo.os.distro,
      osRelease: systemInfo.os.release,
      osCodename: systemInfo.os.codename,
      osKernel: systemInfo.os.kernel,
      osArch: systemInfo.os.arch,
      osHostname: systemInfo.os.hostname,
      osFqdn: systemInfo.os.fqdn,
      osCodepage: systemInfo.os.codepage,
      osLogofile: systemInfo.os.logofile,
      osSerial: systemInfo.os.serial,
      osBuild: systemInfo.os.build,
      osServicepack: systemInfo.os.servicepack,
      osUefi: systemInfo.os.uefi,
      osHypervisor: systemInfo.os.hypervisor,
      osRemoteSession: systemInfo.os.remoteSession,
      cpuManufacturer: systemInfo.cpu.manufacturer,
      cpuBrand: systemInfo.cpu.brand,
      cpuVendor: systemInfo.cpu.vendor,
      cpuFamily: systemInfo.cpu.family,
      cpuModel: systemInfo.cpu.model,
      cpuStepping: systemInfo.cpu.stepping,
      cpuRevision: systemInfo.cpu.revision,
      cpuVoltage: systemInfo.cpu.voltage,
      cpuSpeed: systemInfo.cpu.speed,
      cpuSpeedMin: systemInfo.cpu.speedMin,
      cpuSpeedMax: systemInfo.cpu.speedMax,
      cpuGovernor: systemInfo.cpu.governor,
      cpuCores: systemInfo.cpu.cores,
      cpuPhysicalCores: systemInfo.cpu.physicalCores,
      cpuPerformanceCores: systemInfo.cpu.performanceCores,
      cpuEfficiencyCores: systemInfo.cpu.efficiencyCores,
      cpuProcessors: systemInfo.cpu.processors,
      cpuSocket: systemInfo.cpu.socket,
      cpuFlags: systemInfo.cpu.flags,
      cpuVirtualization: systemInfo.cpu.virtualization
    };
    console.log(systemInfoJSON);
    process.exit(1);
    return systemInfoJSON;
  } catch (error) {
    console.error('Erro ao gerar informações do sistema:', error.message);
    return null;
  }
}

generateSystemInfoJSON().then(async (systemInfoJSON) => {
  if (systemInfoJSON) {
    try {
        const insertOrUpdateQuery = `
        INSERT INTO public.system_info (
            userName,
            version,
            systemManufacturer,
            systemModel,
            systemVersion,
            systemSerial,
            systemUuid,
            systemSku,
            systemVirtual,
            biosVendor,
            biosVersion,
            biosReleaseDate,
            biosRevision,
            biosSerial,
            chassisManufacturer,
            chassisModel,
            chassisType,
            chassisVersion,
            chassisSerial,
            chassisAssetTag,
            chassisSku,
            osPlatform,
            osDistro,
            osRelease,
            osCodename,
            osKernel,
            osArch,
            osHostname,
            osFqdn,
            osCodepage,
            osLogofile,
            osSerial,
            osBuild,
            osServicepack,
            osUefi,
            osHypervisor,
            osRemoteSession,
            cpuManufacturer,
            cpuBrand,
            cpuVendor,
            cpuFamily,
            cpuModel,
            cpuStepping,
            cpuRevision,
            cpuVoltage,
            cpuSpeed,
            cpuSpeedMin,
            cpuSpeedMax,
            cpuGovernor,
            cpuCores,
            cpuPhysicalCores,
            cpuPerformanceCores,
            cpuEfficiencyCores,
            cpuProcessors,
            cpuSocket,
            cpuFlags,
            cpuVirtualization
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39,
            $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57 
          )
          ON CONFLICT (userName) DO UPDATE
          SET
            version = EXCLUDED.version,
            systemManufacturer = EXCLUDED.systemManufacturer,
            systemModel = EXCLUDED.systemModel,
            systemVersion = EXCLUDED.systemVersion,
            systemSerial = EXCLUDED.systemSerial,
            systemUuid = EXCLUDED.systemUuid,
            systemSku = EXCLUDED.systemSku,
            systemVirtual = EXCLUDED.systemVirtual,
            biosVendor = EXCLUDED.biosVendor,
            biosVersion = EXCLUDED.biosVersion,
            biosReleaseDate = EXCLUDED.biosReleaseDate,
            biosRevision = EXCLUDED.biosRevision,
            biosSerial = EXCLUDED.biosSerial,
            chassisManufacturer = EXCLUDED.chassisManufacturer,
            chassisModel = EXCLUDED.chassisModel,
            chassisType = EXCLUDED.chassisType,
            chassisVersion = EXCLUDED.chassisVersion,
            chassisSerial = EXCLUDED.chassisSerial,
            chassisAssetTag = EXCLUDED.chassisAssetTag,
            chassisSku = EXCLUDED.chassisSku,
            osPlatform = EXCLUDED.osPlatform,
            osDistro = EXCLUDED.osDistro,
            osRelease = EXCLUDED.osRelease,
            osCodename = EXCLUDED.osCodename,
            osKernel = EXCLUDED.osKernel,
            osArch = EXCLUDED.osArch,
            osHostname = EXCLUDED.osHostname,
            osFqdn = EXCLUDED.osFqdn,
            osCodepage = EXCLUDED.osCodepage,
            osLogofile = EXCLUDED.osLogofile,
            osSerial = EXCLUDED.osSerial,
            osBuild = EXCLUDED.osBuild,
            osServicepack = EXCLUDED.osServicepack,
            osUefi = EXCLUDED.osUefi,
            osHypervisor = EXCLUDED.osHypervisor,
            osRemoteSession = EXCLUDED.osRemoteSession,
            cpuManufacturer = EXCLUDED.cpuManufacturer,
            cpuBrand = EXCLUDED.cpuBrand,
            cpuVendor = EXCLUDED.cpuVendor,
            cpuFamily = EXCLUDED.cpuFamily,
            cpuModel = EXCLUDED.cpuModel,
            cpuStepping = EXCLUDED.cpuStepping,
            cpuRevision = EXCLUDED.cpuRevision,
            cpuVoltage = EXCLUDED.cpuVoltage,
            cpuSpeed = EXCLUDED.cpuSpeed,
            cpuSpeedMin = EXCLUDED.cpuSpeedMin,
            cpuSpeedMax = EXCLUDED.cpuSpeedMax,
            cpuGovernor = EXCLUDED.cpuGovernor,
            cpuCores = EXCLUDED.cpuCores,
            cpuPhysicalCores = EXCLUDED.cpuPhysicalCores,
            cpuPerformanceCores = EXCLUDED.cpuPerformanceCores,
            cpuEfficiencyCores = EXCLUDED.cpuEfficiencyCores,
            cpuProcessors = EXCLUDED.cpuProcessors,
            cpuSocket = EXCLUDED.cpuSocket,
            cpuFlags = EXCLUDED.cpuFlags,
            cpuVirtualization = EXCLUDED.cpuVirtualization
        `;

      const values = Object.values(systemInfoJSON);
      console.log(values);
    
      await pool.query(insertOrUpdateQuery, values);
      console.log('Dados inseridos/atualizados com sucesso!');
    } catch (error) {
      console.error('Erro ao inserir/atualizar dados:', error.message);
    }
  }
});