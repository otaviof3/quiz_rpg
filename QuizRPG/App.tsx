import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';

const { width, height } = Dimensions.get('window');

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

// 🎯 DADOS MOCKADOS - Banco de perguntas - FIREBASE
const PERGUNTAS_MOCK: Pergunta[] = [
  {
    id: 1,
    pergunta: "Qual é a capital da França?",
    opcoes: ["Paris", "Lyon", "Marselha", "Toulouse"],
    resposta_correta: 0,
    dificuldade: "fácil",
    categoria: "Geografia"
  },
  {
    id: 2,
    pergunta: "Quem pintou a Mona Lisa?",
    opcoes: ["Michelangelo", "Leonardo da Vinci", "Rafael", "Donatello"],
    resposta_correta: 1,
    dificuldade: "médio",
    categoria: "Arte"
  },
  {
    id: 3,
    pergunta: "Qual é o maior planeta do Sistema Solar?",
    opcoes: ["Terra", "Marte", "Júpiter", "Saturno"],
    resposta_correta: 2,
    dificuldade: "fácil",
    categoria: "Ciência"
  },
  {
    id: 4,
    pergunta: "Em que ano o homem pisou na Lua pela primeira vez?",
    opcoes: ["1965", "1969", "1972", "1975"],
    resposta_correta: 1,
    dificuldade: "médio",
    categoria: "História"
  },
  {
    id: 5,
    pergunta: "Qual é o menor país do mundo?",
    opcoes: ["Mônaco", "Vaticano", "San Marino", "Liechtenstein"],
    resposta_correta: 1,
    dificuldade: "difícil",
    categoria: "Geografia"
  },
  {
    id: 6,
    pergunta: "Quem escreveu 'Dom Casmurro'?",
    opcoes: ["José de Alencar", "Machado de Assis", "Castro Alves", "Graciliano Ramos"],
    resposta_correta: 1,
    dificuldade: "médio",
    categoria: "Literatura"
  },
  {
    id: 7,
    pergunta: "Qual é a velocidade da luz?",
    opcoes: ["300.000 km/s", "150.000 km/s", "500.000 km/s", "1.000.000 km/s"],
    resposta_correta: 0,
    dificuldade: "difícil",
    categoria: "Ciência"
  },
  {
    id: 8,
    pergunta: "Quantos continentes existem na Terra?",
    opcoes: ["5", "6", "7", "8"],
    resposta_correta: 2,
    dificuldade: "fácil",
    categoria: "Geografia"
  },
  {
    id: 9,
    pergunta: "Quem foi o primeiro presidente do Brasil?",
    opcoes: ["Dom Pedro II", "Getúlio Vargas", "Marechal Deodoro da Fonseca", "Floriano Peixoto"],
    resposta_correta: 2,
    dificuldade: "médio",
    categoria: "História"
  },
  {
    id: 10,
    pergunta: "Qual é o elemento químico representado pela letra 'O'?",
    opcoes: ["Ouro", "Oxigênio", "Ósmio", "Oganesson"],
    resposta_correta: 1,
    dificuldade: "fácil",
    categoria: "Química"
  }
];

export default function QuizRPG() {
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [stats, setStats] = useState<Stats>({ level: 1, xp: 0, hp: 100, xp_para_proximo: 100 });
  const [inimigo, setInimigo] = useState({ hp: 50, maxHp: 50, level: 1 });
  const [loading, setLoading] = useState(true);
  const [respondida, setRespondida] = useState(false);
  const [resultado, setResultado] = useState<ResultadoResposta | null>(null);
  const [perguntasUsadas, setPerguntasUsadas] = useState<number[]>([]);

  // Animações
  const playerHpAnim = useRef(new Animated.Value(stats.hp)).current;
  const inimigoHpAnim = useRef(new Animated.Value(inimigo.hp)).current;
  const damoAnim = useRef(new Animated.Value(0)).current;
  const levelUpScale = useRef(new Animated.Value(0)).current;
  const floatingDamageAnim = useRef(new Animated.Value(0)).current;
  const floatingDamageOpacity = useRef(new Animated.Value(1)).current;

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

  const carregarPergunta = () => {
    setLoading(true);
    
    // Simular delay de rede (300ms)
    setTimeout(() => {
      // Pegar perguntas ainda não usadas
      const disponiveis = PERGUNTAS_MOCK.filter(p => !perguntasUsadas.includes(p.id));
      
      // Se acabaram as perguntas, reiniciar o pool
      if (disponiveis.length === 0) {
        setPerguntasUsadas([]);
        const novaPergunta = PERGUNTAS_MOCK[Math.floor(Math.random() * PERGUNTAS_MOCK.length)];
        setPergunta(novaPergunta);
        setPerguntasUsadas([novaPergunta.id]);
      } else {
        const novaPergunta = disponiveis[Math.floor(Math.random() * disponiveis.length)];
        setPergunta(novaPergunta);
        setPerguntasUsadas(prev => [...prev, novaPergunta.id]);
      }
      
      setRespondida(false);
      setResultado(null);
      setLoading(false);
    }, 300);
  };

  const verificarResposta = (opcaoSelecionada: number) => {
    if (!pergunta) return;

    const acertou = opcaoSelecionada === pergunta.resposta_correta;
    
    // Calcular dano e XP
    const danoMap: { [key: string]: number } = { 
      "fácil": 5, 
      "médio": 10, 
      "difícil": 20 
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
      hp: levelUp ? 100 : novoHp, // Recupera HP ao subir de level
      xp_para_proximo: xpParaProximo
    };

    const resultadoResposta: ResultadoResposta = {
      acertou,
      dano_ao_inimigo,
      dano_ao_usuario,
      xp_ganho,
      level_up: levelUp,
      stats: novasStats,
      resposta_correta: pergunta.resposta_correta
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

      // Level up
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
        Alert.alert('Game Over', `Você alcançou o Level ${novasStats.level}!`, [
          { text: 'Recomeçar', onPress: recomecar },
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

    // Dano flutuante
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
    setPerguntasUsadas([]);
    carregarPergunta();
  };

  const barraHpColor = (hp: number, maxHp: number) => {
    const percentual = hp / maxHp;
    if (percentual > 0.5) return '#4CAF50';
    if (percentual > 0.25) return '#FFC107';
    return '#F44336';
  };

  const playerHpWidth = playerHpAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp'
  });

  const inimigoHpWidth = inimigoHpAnim.interpolate({
    inputRange: [0, inimigo.maxHp],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp'
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          <Text style={[styles.statText, { color: '#FF6B6B' }]}>❤️ {stats.hp}/100</Text>
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
        <Text style={styles.categoria}>{pergunta?.categoria.toUpperCase()}</Text>
        <Text style={styles.perguntaTexto}>{pergunta?.pergunta}</Text>

        <View style={styles.opcoesContainer}>
          {pergunta?.opcoes.map((opcao, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.opcao,
                respondida && {
                  backgroundColor:
                    index === resultado?.resposta_correta
                      ? '#4CAF50'
                      : '#666',
                },
              ]}
              onPress={() => !respondida && verificarResposta(index)}
              disabled={respondida}
            >
              <Text
                style={[
                  styles.opcaoTexto,
                  respondida && {
                    color: 'white',
                    fontWeight: 'bold',
                  },
                ]}
              >
                {String.fromCharCode(65 + index)}) {opcao}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {respondida && (
          <View style={[styles.resultadoContainer, { backgroundColor: resultado?.acertou ? '#C8E6C9' : '#FFCDD2' }]}>
            <Text style={[styles.resultadoTexto, { color: resultado?.acertou ? '#2E7D32' : '#C62828' }]}>
              {resultado?.acertou ? '✅ ACERTO!' : '❌ ERRO!'}
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
        <Text style={styles.hpText}>
          {Math.round(stats.hp)}/100
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingTop: 40,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerStats: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  statText: {
    color: '#00D4FF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  xpText: {
    color: '#FFD700',
    fontSize: 12,
    marginTop: 4,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  inimigoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  inimigoCard: {
    backgroundColor: '#16213E',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  inimigoNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
    textAlign: 'center',
  },
  inimigoLevel: {
    fontSize: 14,
    color: '#FFD700',
    textAlign: 'center',
    marginTop: 4,
  },
  hpBarContainer: {
    height: 24,
    backgroundColor: '#333',
    borderRadius: 12,
    marginVertical: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#555',
  },
  hpBar: {
    height: '100%',
    borderRadius: 12,
  },
  hpText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  floatingDamage: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  perguntaContainer: {
    backgroundColor: '#16213E',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    justifyContent: 'center',
  },
  categoria: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00D4FF',
    marginBottom: 8,
    textAlign: 'center',
  },
  perguntaTexto: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  opcoesContainer: {
    gap: 10,
  },
  opcao: {
    backgroundColor: '#0F3460',
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  opcaoTexto: {
    color: '#00D4FF',
    fontSize: 14,
    fontWeight: '500',
  },
  resultadoContainer: {
    marginTop: 16,
    borderRadius: 10,
    padding: 12,
  },
  resultadoTexto: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultadoDetalhe: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  playerContainer: {
    backgroundColor: '#16213E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  playerNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D4FF',
    marginBottom: 8,
  },
  levelUpOverlay: {
    position: 'absolute',
    width: width * 0.8,
    alignSelf: 'center',
    top: height / 2 - 80,
    backgroundColor: '#FFD700',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    zIndex: 1000,
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  levelUpText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  levelUpLevel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginTop: 10,
  },
});