import React, { useState, useEffect, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";

const { width, height } = Dimensions.get("window");

interface Pergunta {
  id: number;
  pergunta: string;
  opcoes: string[];
  resposta_correta: number;
  dificuldade: string;
  categoria: string;
}

interface Stats {
  level: number;
  xp: number;
  hp: number;
  xp_para_proximo: number;
}

interface ResultadoResposta {
  acertou: boolean;
  dano_ao_inimigo: number;
  dano_ao_usuario: number;
  xp_ganho: number;
  level_up: boolean;
  stats: Stats;
  resposta_correta: number;
}

// Configuração da API Gemini
const GEMINI_API_KEY = "AIzaSyB2g1kWZjd70ks9w3Czt6v940jgtmB4PBA"; // Substitua pela sua chave
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

// Sistema de Rate Limiting
class RateLimiter {
  private lastRequestTime: number = 0;
  private minInterval: number = 30000; // 30 segundos entre requisições (2 por minuto)

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      console.log(`Aguardando ${waitTime}ms para respeitar rate limit...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

const rateLimiter = new RateLimiter();

// Banco de perguntas fallback (caso a API falhe)
const PERGUNTAS_FALLBACK: Omit<Pergunta, "id">[] = [
  {
    pergunta: "Qual é a capital da França?",
    opcoes: ["Londres", "Paris", "Berlim", "Madri"],
    resposta_correta: 1,
    dificuldade: "fácil",
    categoria: "Geografia",
  },
  {
    pergunta: "Quem pintou a Mona Lisa?",
    opcoes: ["Michelangelo", "Leonardo da Vinci", "Rafael", "Donatello"],
    resposta_correta: 1,
    dificuldade: "fácil",
    categoria: "Arte",
  },
  {
    pergunta: "Qual é o maior planeta do Sistema Solar?",
    opcoes: ["Terra", "Marte", "Júpiter", "Saturno"],
    resposta_correta: 2,
    dificuldade: "fácil",
    categoria: "Ciência",
  },
  {
    pergunta: "Em que ano chegou o homem à Lua?",
    opcoes: ["1965", "1969", "1972", "1975"],
    resposta_correta: 1,
    dificuldade: "médio",
    categoria: "História",
  },
  {
    pergunta: "Quanto é 8 x 7?",
    opcoes: ["54", "56", "63", "72"],
    resposta_correta: 1,
    dificuldade: "fácil",
    categoria: "Matemática",
  },
  {
    pergunta: "Quem escreveu 'Dom Casmurro'?",
    opcoes: [
      "José de Alencar",
      "Machado de Assis",
      "Aluísio Azevedo",
      "Castro Alves",
    ],
    resposta_correta: 1,
    dificuldade: "médio",
    categoria: "Literatura",
  },
  {
    pergunta: "Qual é a fórmula química da água?",
    opcoes: ["H2O", "CO2", "O2", "NaCl"],
    resposta_correta: 0,
    dificuldade: "fácil",
    categoria: "Ciência",
  },
  {
    pergunta: "Em que continente fica o Egito?",
    opcoes: ["Ásia", "Europa", "África", "América"],
    resposta_correta: 2,
    dificuldade: "fácil",
    categoria: "Geografia",
  },
  {
    pergunta: "Qual é a linguagem de programação mais usada para web?",
    opcoes: ["Python", "JavaScript", "Java", "C++"],
    resposta_correta: 1,
    dificuldade: "médio",
    categoria: "Tecnologia",
  },
  {
    pergunta: "Quantos jogadores tem um time de futebol?",
    opcoes: ["9", "10", "11", "12"],
    resposta_correta: 2,
    dificuldade: "fácil",
    categoria: "Esportes",
  },
  {
    pergunta: "Qual é a velocidade da luz?",
    opcoes: ["300.000 km/s", "150.000 km/s", "450.000 km/s", "600.000 km/s"],
    resposta_correta: 0,
    dificuldade: "médio",
    categoria: "Ciência",
  },
  {
    pergunta: "Quem descobriu o Brasil?",
    opcoes: [
      "Cristóvão Colombo",
      "Pedro Álvares Cabral",
      "Vasco da Gama",
      "Fernão de Magalhães",
    ],
    resposta_correta: 1,
    dificuldade: "fácil",
    categoria: "História",
  },
  {
    pergunta: "Qual é a raiz quadrada de 144?",
    opcoes: ["10", "11", "12", "13"],
    resposta_correta: 2,
    dificuldade: "médio",
    categoria: "Matemática",
  },
  {
    pergunta: "Qual artista é conhecido como o 'Rei do Pop'?",
    opcoes: ["Elvis Presley", "Michael Jackson", "Prince", "David Bowie"],
    resposta_correta: 1,
    dificuldade: "fácil",
    categoria: "Arte",
  },
  {
    pergunta: "Qual é o menor país do mundo?",
    opcoes: ["Mônaco", "Vaticano", "San Marino", "Liechtenstein"],
    resposta_correta: 1,
    dificuldade: "difícil",
    categoria: "Geografia",
  },
];

export default function QuizRPG() {
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [stats, setStats] = useState<Stats>({
    level: 1,
    xp: 0,
    hp: 100,
    xp_para_proximo: 50,
  });
  const [inimigo, setInimigo] = useState({ hp: 50, maxHp: 50, level: 1 });
  const [loading, setLoading] = useState(true);
  const [respondida, setRespondida] = useState(false);
  const [resultado, setResultado] = useState<ResultadoResposta | null>(null);
  const [perguntaId, setPerguntaId] = useState(1);
  const [waitingForRateLimit, setWaitingForRateLimit] = useState(false);
  const [usarFallback, setUsarFallback] = useState(false);
  const perguntasUsadas = useRef<number[]>([]);
  const ultimaFalhaApi = useRef<number>(0);
  const FALLBACK_COOLDOWN = 60000; // 1 minuto no fallback antes de tentar API novamente

  // Animações
  const playerHpAnim = useRef(new Animated.Value(100)).current;
  const inimigoHpAnim = useRef(new Animated.Value(50)).current;
  const damoAnim = useRef(new Animated.Value(0)).current;
  const levelUpScale = useRef(new Animated.Value(0)).current;
  const floatingDamageAnim = useRef(new Animated.Value(0)).current;
  const floatingDamageOpacity = useRef(new Animated.Value(1)).current;

  const podeTentarApiNovamente = () => {
    const agora = Date.now();
    return agora - ultimaFalhaApi.current > FALLBACK_COOLDOWN;
  };

  // Carregar pergunta ao iniciar
  useEffect(() => {
    carregarPergunta();
  }, []);

  // Animar HP quando mudar
  useEffect(() => {
    Animated.spring(playerHpAnim, {
      toValue: stats.hp,
      useNativeDriver: false,
      speed: 10,
    }).start();
  }, [stats.hp]);

  useEffect(() => {
    Animated.spring(inimigoHpAnim, {
      toValue: inimigo.hp,
      useNativeDriver: false,
      speed: 10,
    }).start();
  }, [inimigo.hp]);

  const gerarPerguntaComGemini = async (
    retryCount = 0
  ): Promise<Pergunta | null> => {
    try {
      // Verificar se a chave API está configurada
      if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === "") {
        console.log("Chave API não configurada, usando perguntas fallback");
        ultimaFalhaApi.current = Date.now();
        setUsarFallback(true);
        return null;
      }

      // Aguardar se necessário para respeitar rate limit
      setWaitingForRateLimit(true);
      await rateLimiter.waitIfNeeded();
      setWaitingForRateLimit(false);

      // Categorias variadas para diversidade
      const categorias = [
        "Geografia",
        "História",
        "Ciência",
        "Matemática",
        "Literatura",
        "Arte",
        "Tecnologia",
        "Esportes",
      ];
      const dificuldades = ["fácil", "médio", "difícil"];

      // Seleciona categoria e dificuldade baseado no level
      const categoria =
        categorias[Math.floor(Math.random() * categorias.length)];
      const indexDificuldade = Math.min(Math.floor(stats.level / 2), 2);
      const dificuldade = dificuldades[indexDificuldade];

      const prompt = `Crie uma pergunta de quiz de múltipla escolha sobre ${categoria} com dificuldade ${dificuldade}.

IMPORTANTE: Retorne APENAS um objeto JSON válido, sem texto adicional, no seguinte formato:
{
  "pergunta": "texto da pergunta aqui",
  "opcoes": ["opção A", "opção B", "opção C", "opção D"],
  "resposta_correta": 0,
  "categoria": "${categoria}",
  "dificuldade": "${dificuldade}"
}

Regras:
- A pergunta deve ser clara e objetiva
- Forneça exatamente 4 opções de resposta
- resposta_correta deve ser o índice (0-3) da opção correta
- Todas as opções devem ser plausíveis
- A pergunta deve ser apropriada para o nível de dificuldade ${dificuldade}`;

      console.log("Fazendo requisição para Gemini...");
      console.log("URL:", GEMINI_API_URL);

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048, // Aumentado para evitar cortes
          },
        }),
      });

      console.log("Status da resposta:", response.status);

      // Tratamento específico para erro 429
      if (response.status === 429) {
        console.log("Rate limit atingido, mudando para modo fallback");
        ultimaFalhaApi.current = Date.now();
        setUsarFallback(true);
        return null;
      }

      if (!response.ok) {
        let errorText = "Erro desconhecido";
        try {
          const errorData = await response.json();
          console.error(
            "Erro da API (JSON):",
            JSON.stringify(errorData, null, 2)
          );
          errorText = errorData?.error?.message || JSON.stringify(errorData);
        } catch (e) {
          errorText = await response.text();
          console.error("Erro da API (texto):", errorText);
        }

        // Se falhar, usar fallback
        console.log("Erro na API, mudando para modo fallback");
        ultimaFalhaApi.current = Date.now();
        setUsarFallback(true);
        return null;
      }

      const data = await response.json();
      console.log("Resposta completa:", JSON.stringify(data, null, 2));

      // Verificar se a resposta tem a estrutura esperada
      if (!data || typeof data !== "object") {
        throw new Error("Resposta da API não é um objeto válido");
      }

      if (
        !data.candidates ||
        !Array.isArray(data.candidates) ||
        data.candidates.length === 0
      ) {
        console.error("Estrutura inválida - candidates:", data.candidates);
        throw new Error("API não retornou candidatos de resposta");
      }

      const candidate = data.candidates[0];
      if (!candidate || !candidate.content) {
        console.error("Estrutura inválida - candidate:", candidate);
        throw new Error("Candidato de resposta inválido");
      }

      if (
        !candidate.content.parts ||
        !Array.isArray(candidate.content.parts) ||
        candidate.content.parts.length === 0
      ) {
        console.error("Estrutura inválida - parts:", candidate.content.parts);
        throw new Error("Resposta não contém partes válidas");
      }

      const textoResposta = candidate.content.parts[0].text;

      if (!textoResposta || typeof textoResposta !== "string") {
        console.error("Texto da resposta inválido:", textoResposta);
        throw new Error("Texto da resposta é inválido");
      }

      console.log("Texto da resposta:", textoResposta);

      // Limpar o texto da resposta (remover markdown se houver)
      const jsonText = textoResposta
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      console.log("JSON limpo:", jsonText);

      let perguntaData;
      try {
        perguntaData = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error("Erro ao fazer parse do JSON:", parseError.message);
        console.error("JSON que falhou:", jsonText);
        console.log("Mudando para modo fallback devido a erro de parse");
        ultimaFalhaApi.current = Date.now();
        setUsarFallback(true);
        return null;
      }

      // Validar estrutura
      if (!perguntaData || typeof perguntaData !== "object") {
        throw new Error("Pergunta não é um objeto válido");
      }

      if (!perguntaData.pergunta || typeof perguntaData.pergunta !== "string") {
        throw new Error('Campo "pergunta" inválido');
      }

      if (
        !Array.isArray(perguntaData.opcoes) ||
        perguntaData.opcoes.length !== 4
      ) {
        throw new Error('Campo "opcoes" deve ser um array com 4 itens');
      }

      if (
        typeof perguntaData.resposta_correta !== "number" ||
        perguntaData.resposta_correta < 0 ||
        perguntaData.resposta_correta > 3
      ) {
        throw new Error(
          'Campo "resposta_correta" deve ser um número entre 0 e 3'
        );
      }

      console.log("Pergunta gerada com sucesso!");

      return {
        id: perguntaId,
        pergunta: perguntaData.pergunta,
        opcoes: perguntaData.opcoes,
        resposta_correta: perguntaData.resposta_correta,
        dificuldade: perguntaData.dificuldade || dificuldade,
        categoria: perguntaData.categoria || categoria,
      };
    } catch (error: any) {
      console.error("Erro ao gerar pergunta:", error.message);
      console.error("Stack trace:", error.stack);

      // Em caso de erro, usar fallback
      console.log("Mudando para modo fallback devido a erro");
      ultimaFalhaApi.current = Date.now();
      setUsarFallback(true);
      return null;
    }
  };

  const gerarPerguntaFallback = (): Pergunta => {
    // Filtrar perguntas disponíveis (não usadas)
    const disponveis = PERGUNTAS_FALLBACK.filter(
      (_, index) => !perguntasUsadas.current.includes(index)
    );

    // Se usou todas, resetar
    if (disponveis.length === 0) {
      perguntasUsadas.current = [];
      return gerarPerguntaFallback();
    }

    // Selecionar pergunta aleatória
    const indexAleatorio = Math.floor(Math.random() * disponveis.length);
    const perguntaSelecionada = disponveis[indexAleatorio];

    // Marcar como usada
    const indexOriginal = PERGUNTAS_FALLBACK.indexOf(perguntaSelecionada);
    perguntasUsadas.current.push(indexOriginal);

    return {
      id: perguntaId,
      ...perguntaSelecionada,
    };
  };

  const carregarPergunta = async () => {
    setLoading(true);
    setRespondida(false);
    setResultado(null);

    let novaPergunta: Pergunta | null = null;

    // Se estamos em fallback, verificar se já passou cooldown
    if (usarFallback && podeTentarApiNovamente()) {
      console.log("Cooldown finalizado — tentando API novamente...");
      setUsarFallback(false); // libera para tentar API
    }

    // Tenta API primeiro (desde que não esteja em fallback ativo)
    if (!usarFallback) {
      novaPergunta = await gerarPerguntaComGemini();

      // Se a API voltou a funcionar
      if (novaPergunta !== null) {
        console.log("A API voltou a responder — saindo do fallback");
        setUsarFallback(false);
      }
    }

    // Se API falhou ou ainda está em fallback → usar fallback temporário
    if (!novaPergunta) {
      novaPergunta = gerarPerguntaFallback();
    }

    setPergunta(novaPergunta);
    setPerguntaId((prev) => prev + 1);
    setLoading(false);
  };

  const verificarResposta = (opcaoSelecionada: number) => {
    if (!pergunta) return;

    const acertou = opcaoSelecionada === pergunta.resposta_correta;

    // Calcular dano e XP
    const danoMap: { [key: string]: number } = {
      fácil: 5,
      médio: 10,
      difícil: 20,
    };

    const dano_ao_inimigo = acertou ? danoMap[pergunta.dificuldade] || 10 : 0;
    const dano_ao_usuario = acertou ? 0 : 5;
    const xp_ganho = acertou ? (danoMap[pergunta.dificuldade] || 10) * 2 : 0;

    // Atualizar stats
    const novoXp = stats.xp + xp_ganho;
    const novoHp = Math.max(0, stats.hp - dano_ao_usuario);
    let novoLevel = stats.level;
    let xpParaProximo = stats.xp_para_proximo;
    let levelUp = false;

    // Verificar level up
    let xpRestante = novoXp;
    while (xpRestante >= xpParaProximo) {
      novoLevel++;
      xpRestante -= xpParaProximo;
      xpParaProximo = Math.floor(xpParaProximo * 1.5);
      levelUp = true;
    }

    const novasStats: Stats = {
      level: novoLevel,
      xp: xpRestante,
      hp: levelUp ? 100 : novoHp,
      xp_para_proximo: xpParaProximo,
    };

    const resultadoResposta: ResultadoResposta = {
      acertou,
      dano_ao_inimigo,
      dano_ao_usuario,
      xp_ganho,
      level_up: levelUp,
      stats: novasStats,
      resposta_correta: pergunta.resposta_correta,
    };

    setResultado(resultadoResposta);
    setStats(novasStats);
    setRespondida(true);

    // Animar dano
    if (acertou) {
      animarAcerto(dano_ao_inimigo);
      setInimigo((prev) => ({
        ...prev,
        hp: Math.max(0, prev.hp - dano_ao_inimigo),
      }));

      if (levelUp) {
        animarLevelUp();
      }
    } else {
      animarErro(dano_ao_usuario);
    }

    // Próxima pergunta depois de 2 segundos
    setTimeout(() => {
      if (novasStats.hp > 0) {
        if (inimigo.hp - (acertou ? dano_ao_inimigo : 0) <= 0) {
          novoInimigo();
        } else {
          carregarPergunta();
        }
      } else {
        Alert.alert("Game Over", `Você alcançou o Level ${novasStats.level}!`, [
          { text: "Recomeçar", onPress: recomecar },
        ]);
      }
    }, 2000);
  };

  const animarAcerto = (dano: number) => {
    Animated.sequence([
      Animated.timing(damoAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(damoAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    floatingDamageAnim.setValue(0);
    floatingDamageOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(floatingDamageAnim, {
        toValue: -50,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(floatingDamageOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animarErro = (dano: number) => {
    Animated.sequence([
      Animated.timing(playerHpAnim, {
        toValue: stats.hp - dano,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const animarLevelUp = () => {
    levelUpScale.setValue(0);
    Animated.sequence([
      Animated.spring(levelUpScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
      }),
      Animated.delay(800),
      Animated.spring(levelUpScale, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
      }),
    ]).start();
  };

  const novoInimigo = () => {
    setInimigo({
      hp: 50 + stats.level * 10,
      maxHp: 50 + stats.level * 10,
      level: inimigo.level + 1,
    });
    carregarPergunta();
  };

  const recomecar = () => {
    setStats({ level: 1, xp: 0, hp: 100, xp_para_proximo: 100 });
    setInimigo({ hp: 50, maxHp: 50, level: 1 });
    setPerguntaId(1);
    carregarPergunta();
  };

  const barraHpColor = (hp: number, maxHp: number) => {
    const percentual = hp / maxHp;
    if (percentual > 0.5) return "#4CAF50";
    if (percentual > 0.25) return "#FFC107";
    return "#F44336";
  };

  const playerHpWidth = playerHpAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  const inimigoHpWidth = inimigoHpAnim.interpolate({
    inputRange: [0, inimigo.maxHp],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>
          {waitingForRateLimit
            ? "Aguardando limite de requisições..."
            : pergunta
            ? "Carregando próxima pergunta..."
            : "Gerando pergunta com IA..."}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerStats}>
          <Text style={styles.statText}>Level {stats.level}</Text>
          <Text style={styles.xpText}>
            XP: {stats.xp}/{stats.xp_para_proximo}
          </Text>
        </View>
        <Text style={styles.title}>⚔️ Quiz RPG</Text>
        <View style={styles.headerStats}>
          <Text style={[styles.statText, { color: "#FF6B6B" }]}>
            ❤️ {stats.hp}/100
          </Text>
        </View>
      </View>

      {/* Inimigo */}
      <View style={styles.inimigoContainer}>
        <View style={styles.inimigoCard}>
          <Text style={styles.inimigoNome}>👹 Inimigo</Text>
          <Text style={styles.inimigoLevel}>Level {inimigo.level}</Text>

          <View style={styles.hpBarContainer}>
            <Animated.View
              style={[
                styles.hpBar,
                {
                  width: inimigoHpWidth,
                  backgroundColor: barraHpColor(inimigo.hp, inimigo.maxHp),
                },
              ]}
            />
          </View>
          <Text style={styles.hpText}>
            {Math.round(inimigo.hp)}/{inimigo.maxHp}
          </Text>

          {/* Dano flutuante */}
          {resultado?.acertou && resultado.dano_ao_inimigo > 0 && (
            <Animated.Text
              style={[
                styles.floatingDamage,
                {
                  transform: [{ translateY: floatingDamageAnim }],
                  opacity: floatingDamageOpacity,
                },
              ]}
            >
              -{resultado.dano_ao_inimigo}
            </Animated.Text>
          )}
        </View>
      </View>

      {/* Pergunta */}
      <View style={styles.perguntaContainer}>
        <Text style={styles.categoria}>
          {pergunta?.categoria.toUpperCase()} •{" "}
          {pergunta?.dificuldade.toUpperCase()}
        </Text>
        <Text style={styles.perguntaTexto}>{pergunta?.pergunta}</Text>

        <ScrollView
          style={styles.opcoesScrollContainer}
          contentContainerStyle={styles.opcoesContainer}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          {pergunta?.opcoes.map((opcao, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.opcao,
                respondida && {
                  backgroundColor:
                    index === resultado?.resposta_correta
                      ? "#4CAF50" // Verde para resposta correta
                      : "#666", // Cinza para incorretas
                },
              ]}
              onPress={() => !respondida && verificarResposta(index)}
              disabled={respondida}
            >
              <Text
                style={[
                  styles.opcaoTexto,
                  respondida && {
                    color: "white",
                    fontWeight: "bold",
                  },
                ]}
              >
                {String.fromCharCode(65 + index)}) {opcao}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {respondida && (
          <View
            style={[
              styles.resultadoContainer,
              { backgroundColor: resultado?.acertou ? "#C8E6C9" : "#FFCDD2" },
            ]}
          >
            <Text
              style={[
                styles.resultadoTexto,
                { color: resultado?.acertou ? "#2E7D32" : "#C62828" },
              ]}
            >
              {resultado?.acertou ? "✅ ACERTO!" : "❌ ERRO!"}
            </Text>
            <Text style={styles.resultadoDetalhe}>
              {resultado?.acertou
                ? `+${resultado.dano_ao_inimigo} dano ao inimigo | +${resultado.xp_ganho} XP`
                : `-${resultado?.dano_ao_usuario} HP`}
            </Text>
          </View>
        )}
      </View>

      {/* Jogador HP */}
      <View style={styles.playerContainer}>
        <Text style={styles.playerNome}>🧙 Você</Text>
        <View style={styles.hpBarContainer}>
          <Animated.View
            style={[
              styles.hpBar,
              {
                width: playerHpWidth,
                backgroundColor: barraHpColor(stats.hp, 100),
              },
            ]}
          />
        </View>
        <Text style={styles.hpText}>{Math.round(stats.hp)}/100</Text>
      </View>

      {/* Level Up Animation */}
      {resultado?.level_up && (
        <Animated.View
          style={[
            styles.levelUpOverlay,
            {
              transform: [{ scale: levelUpScale }],
              opacity: levelUpScale,
            },
          ]}
        >
          <Text style={styles.levelUpText}>⭐ LEVEL UP! ⭐</Text>
          <Text style={styles.levelUpLevel}>Nível {stats.level}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 16,
    paddingTop: 40,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerStats: {
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF6B6B",
  },
  statText: {
    color: "#00D4FF",
    fontSize: 14,
    fontWeight: "bold",
  },
  xpText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
    textAlign: "center",
  },
  inimigoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  inimigoCard: {
    backgroundColor: "#16213E",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    borderWidth: 2,
    borderColor: "#FF6B6B",
  },
  inimigoNome: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF6B6B",
    textAlign: "center",
  },
  inimigoLevel: {
    fontSize: 14,
    color: "#FFD700",
    textAlign: "center",
    marginTop: 4,
  },
  hpBarContainer: {
    height: 24,
    backgroundColor: "#333",
    borderRadius: 12,
    marginVertical: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#555",
  },
  hpBar: {
    height: "100%",
    borderRadius: 12,
  },
  hpText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "bold",
  },
  floatingDamage: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    fontSize: 32,
    fontWeight: "bold",
    color: "#FF6B6B",
  },
  perguntaContainer: {
    backgroundColor: "#16213E",
    borderRadius: 12,
    padding: 16,
    flex: 1,
    justifyContent: "center",
  },
  categoria: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#00D4FF",
    marginBottom: 8,
    textAlign: "center",
  },
  perguntaTexto: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  opcoesScrollContainer: {
    maxHeight: height * 0.35, // Limita a altura máxima (35% da tela)
    width: "100%",
  },
  opcoesContainer: {
    gap: 10,
    paddingBottom: 20, // Espaço extra no final para scroll confortável
  },
  opcao: {
    backgroundColor: "#0F3460",
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: "#00D4FF",
    minHeight: 50, // Altura mínima para consistência
  },
  opcaoTexto: {
    color: "#00D4FF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20, // Melhora legibilidade em textos longos
  },
  resultadoContainer: {
    marginTop: 16,
    borderRadius: 10,
    padding: 12,
  },
  resultadoTexto: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  resultadoDetalhe: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },
  playerContainer: {
    backgroundColor: "#16213E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#00D4FF",
  },
  playerNome: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00D4FF",
    marginBottom: 8,
  },
  levelUpOverlay: {
    position: "absolute",
    width: width * 0.8,
    alignSelf: "center",
    top: height / 2 - 80,
    backgroundColor: "#FFD700",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    zIndex: 1000,
    borderWidth: 3,
    borderColor: "#FF6B6B",
  },
  levelUpText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FF6B6B",
  },
  levelUpLevel: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginTop: 10,
  },
});