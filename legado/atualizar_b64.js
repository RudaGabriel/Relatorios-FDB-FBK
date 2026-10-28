const fs = require('fs');

try {
    // Lê os arquivos atuais da pasta
    const js = fs.readFileSync('_server_fdb_rel.js', 'utf8');
    let bat = fs.readFileSync('gerar_relatorio_do_dia_rede.bat', 'utf8');

    // Converte o JS novo para Base64 e divide em blocos de "echo"
    const b64 = Buffer.from(js).toString('base64');
    const lines = b64.match(/.{1,72}/g).map((l, i) => {
        return i === 0 ? '> "%B64%" echo ' + l : '>>"%B64%" echo ' + l;
    }).join('\r\n');

    // Expressão regular para achar onde começa e onde termina o Base64 antigo no BAT
    const regex = /(set "B64=%WEBROOT%\\_server_fdb_rel\.b64"\r?\n)[\s\S]*?(powershell -NoProfile)/;

    if (!regex.test(bat)) {
        console.log("Erro: Não encontrei o bloco Base64 no arquivo BAT.");
        process.exit(1);
    }

    // Substitui o bloco velho pelo bloco novo
    bat = bat.replace(regex, '$1' + lines + '\r\n$2');

    // Salva o BAT atualizado
    fs.writeFileSync('gerar_relatorio_do_dia_rede.bat', bat, 'utf8');

    console.log("Sucesso Absoluto! O Base64 do 'gerar_relatorio_do_dia_rede.bat' foi atualizado.");
} catch (error) {
    console.error("Algo deu errado:", error.message);
}