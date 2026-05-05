const chalk = require('chalk');
function timestamp() { return new Date().toLocaleTimeString('ar-SA', { hour12: false }); }
function info(msg)    { console.log(chalk.cyan(`[${timestamp()}] [INFO] ${msg}`)); }
function success(msg) { console.log(chalk.green(`[${timestamp()}] [OK] ${msg}`)); }
function warn(msg)    { console.log(chalk.yellow(`[${timestamp()}] [WARN] ${msg}`)); }
function error(msg)   { console.log(chalk.red(`[${timestamp()}] [ERROR] ${msg}`)); }
function bot(msg)     { console.log(chalk.magenta(`[${timestamp()}] [BOT] ${msg}`)); }
module.exports = { info, success, warn, error, bot };
