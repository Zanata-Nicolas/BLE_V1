// =====================================================
// AURA - CONTROLE BLE DO PROFESSOR
// Visual novo; comunicação BLE preservada do BLE_V0.
// =====================================================

const pontos = document.querySelectorAll(".ponto");
const destinoTexto = document.getElementById("destinoSelecionado");
const botaoEnviar = document.getElementById("botaoEnviar");
const botaoBluetooth = document.getElementById("botaoBluetooth");
const mensagem = document.getElementById("mensagem");
const statusAgv = document.getElementById("statusAgv");
const indicador = document.getElementById("indicadorConexao");
const textoConexao = document.getElementById("textoConexao");
const textoAjudaConexao = document.getElementById("textoAjudaConexao");
const posicaoTexto = document.getElementById("posicaoAtual");
const aviso = document.getElementById("avisoSistema");
const statusCard = document.querySelector(".status-card");

// UUIDs iguais aos do ESP32
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let dispositivo;
let rx;
let tx;
let conectado = false;
let movimentando = false;
let destinoSelecionado = null;
let destinoEnviado = null;

const nomes = {
  PONTO_A: "Ponto A",
  PONTO_B: "Ponto B"
};

function mostrarMensagem(texto, erro = false) {
  mensagem.textContent = texto;
  if (erro) console.error(texto);
}

function definirStatus(texto, classe = "") {
  statusAgv.textContent = texto;
  statusCard.classList.remove("status-moving", "status-arrived", "status-connected");
  if (classe) statusCard.classList.add(classe);
}

function atualizarConexao() {
  if (conectado) {
    indicador.classList.remove("connection-offline");
    indicador.classList.add("connection-online");
    textoConexao.textContent = "Conectado";
    textoAjudaConexao.textContent = "AURA_AGV";
    botaoBluetooth.querySelector("span").textContent = "AURA conectado";
    botaoBluetooth.disabled = true;
    definirStatus("Aguardando destino", "status-connected");
  } else {
    indicador.classList.remove("connection-online");
    indicador.classList.add("connection-offline");
    textoConexao.textContent = "Desconectado";
    textoAjudaConexao.textContent = "Conecte-se ao robô para iniciar.";
    botaoBluetooth.querySelector("span").textContent = "Conectar ao AURA";
    botaoBluetooth.disabled = false;
    definirStatus("Aguardando conexão");
  }
  atualizarBotoes();
}

function atualizarBotoes() {
  pontos.forEach(ponto => {
    const destino = ponto.dataset.destino;
    if (destino === "INICIO") {
      ponto.disabled = true;
      return;
    }
    ponto.disabled = !conectado || movimentando;
  });
  botaoEnviar.disabled = !conectado || movimentando || !destinoSelecionado;
}

async function conectarBluetooth() {
  if (!navigator.bluetooth) {
    mostrarMensagem("Este navegador não suporta Bluetooth.", true);
    return;
  }

  try {
    dispositivo = await navigator.bluetooth.requestDevice({
      filters: [{ name: "AURA_AGV" }],
      optionalServices: [SERVICE_UUID]
    });

    dispositivo.addEventListener("gattserverdisconnected", desconectouBluetooth);

    const servidor = await dispositivo.gatt.connect();
    const servico = await servidor.getPrimaryService(SERVICE_UUID);
    rx = await servico.getCharacteristic(RX_UUID);
    tx = await servico.getCharacteristic(TX_UUID);

    await tx.startNotifications();
    tx.addEventListener("characteristicvaluechanged", receberStatus);

    conectado = true;
    movimentando = false;
    posicaoTexto.textContent = "Base";
    aviso.textContent = "Escolha Ponto A ou Ponto B.";
    atualizarConexao();
  } catch (erro) {
    console.error(erro);
    conectado = false;
    atualizarConexao();
    mostrarMensagem("Não foi possível conectar ao AURA.", true);
  }
}

function desconectouBluetooth() {
  conectado = false;
  movimentando = false;
  rx = null;
  tx = null;
  aviso.textContent = "Bluetooth desconectado.";
  atualizarConexao();
}

function receberStatus(evento) {
  const texto = new TextDecoder().decode(evento.target.value).trim();
  console.log("ESP32:", texto);

  if (texto === "MOVENDO") {
    movimentando = true;
    definirStatus("Em movimento", "status-moving");
    aviso.textContent = "AURA indo para o destino.";
    atualizarBotoes();
  } else if (texto === "CHEGOU") {
    movimentando = false;
    definirStatus("Chegou ao destino", "status-arrived");
    aviso.textContent = "AURA chegou ao destino.";
    if (destinoEnviado) posicaoTexto.textContent = nomes[destinoEnviado];
    atualizarBotoes();
  } else if (texto === "PARADO") {
    movimentando = false;
    definirStatus("Aguardando destino", "status-connected");
    posicaoTexto.textContent = "Base";
    atualizarBotoes();
  }
}

pontos.forEach(ponto => {
  ponto.addEventListener("click", () => {
    if (ponto.disabled || ponto.dataset.destino === "INICIO") return;

    destinoSelecionado = ponto.dataset.destino;
    destinoTexto.textContent = nomes[destinoSelecionado];

    pontos.forEach(item => {
      item.classList.toggle("selecionado", item === ponto);
    });

    atualizarBotoes();
  });
});

botaoEnviar.addEventListener("click", async () => {
  if (!conectado || movimentando || !destinoSelecionado) return;

  let comando = null;
  if (destinoSelecionado === "PONTO_A") comando = "A";
  if (destinoSelecionado === "PONTO_B") comando = "B";
  if (!comando) return;

  try {
    const dados = new TextEncoder().encode(comando);
    await rx.writeValueWithResponse(dados);

    destinoEnviado = destinoSelecionado;
    movimentando = true;
    definirStatus("Em movimento", "status-moving");
    aviso.textContent = "AURA indo para " + nomes[destinoSelecionado] + ".";
    atualizarBotoes();
  } catch (erro) {
    console.error(erro);
    movimentando = false;
    mostrarMensagem("Erro ao enviar o destino.", true);
    atualizarBotoes();
  }
});

botaoBluetooth.addEventListener("click", conectarBluetooth);

function iniciar() {
  conectado = false;
  movimentando = false;
  posicaoTexto.textContent = "Base";
  aviso.textContent = "Conecte ao robô para começar.";
  atualizarConexao();
}

iniciar();
