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

// ⚠️ CONFIGURE SEU IP AQUI ⚠️
// Descubra com: ipconfig (Windows) ou ifconfig (Mac/Linux)
// Exemplo: http://192.168.1.100:5000/api
// Para Android Emulator use: http://10.0.2.2:5000/api
const API_URL = 'http://192.168.1.104:5000/api';

export default function QuizRPG() {
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [stats, setStats] = useState<Stats>({ level: 1, xp: 0, hp: 100, xp_para_proximo: 100 });
  const [inimigo, setInimigo] = useState({ hp: 50, maxHp: 50, level: 1 });
  const [loading, setLoading] = useState(true);
  const [respondida, setRespondida] = useState(false);
  const [resultado, setResultado] = useState<ResultadoResposta | null>(null);
  const [usuarioId] = useState('player1');

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

  const carregarPergunta = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/pergunta`);
      const data = await response.json();

      if (data.sucesso) {
        setPergunta(data.pergunta);
        setRespondida(false);
        setResultado(null);
      } else {
        Alert.alert('Erro', 'Falha ao carregar pergunta');
      }
    } catch (error) {
      Alert.alert('Erro de Conexão', `Verifique se o servidor está rodando em ${API_URL}`);
    } finally {
      setLoading(false);
    }
  };

  const verificarResposta = async (opcaoSelecionada: number) => {
    if (!pergunta) return;

    try {
      const response = await fetch(`${API_URL}/verificar-resposta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pergunta,
          resposta: opcaoSelecionada,
          usuario_id: usuarioId,
        }),
      });

      const data: ResultadoResposta = await response.json();
      setResultado(data);
      setStats(data.stats);
      setRespondida(true);

      // Animar dano
      if (data.acertou) {
        animarAcerto(data.dano_ao_inimigo);
        setInimigo((prev) => ({
          ...prev,
          hp: Math.max(0, prev.hp - data.dano_ao_inimigo),
        }));

        // Level up
        if (data.level_up) {
          animarLevelUp();
        }
      } else {
        animarErro(data.dano_ao_usuario);
      }

      // Próxima pergunta depois de 2 segundos
      setTimeout(() => {
        if (data.stats.hp > 0) {
          if (inimigo.hp - (data.acertou ? data.dano_ao_inimigo : 0) <= 0) {
            novoInimigo();
          } else {
            carregarPergunta();
          }
        } else {
          Alert.alert('Game Over', `Você alcançou o Level ${data.stats.level}!`, [
            { text: 'Recomeçar', onPress: recomecar },
          ]);
        }
      }, 2000);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao verificar resposta');
    }
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
        toValue: 50,
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

  const recomecar = async () => {
    try {
      await fetch(`${API_URL}/reset/${usuarioId}`, { method: 'POST' });
      setStats({ level: 1, xp: 0, hp: 100, xp_para_proximo: 100 });
      setInimigo({ hp: 50, maxHp: 50, level: 1 });
      carregarPergunta();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao resetar jogo');
    }
  };

  const barraHpColor = (hp: number, maxHp: number) => {
    const percentual = hp / maxHp;
    if (percentual > 0.5) return '#4CAF50';
    if (percentual > 0.25) return '#FFC107';
    return '#F44336';
  };

  const playerHpWidth = playerHpAnim.interpolate({
    inputRange: [0, stats.hp || 1],
    outputRange: ['0%', '100%'],
  });

  const inimigoHpWidth = inimigoHpAnim.interpolate({
    inputRange: [0, inimigo.maxHp],
    outputRange: ['0%', '100%'],
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
                      : index === pergunta.resposta_correta
                      ? '#FF9800'
                      : '#ccc',
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
    right: 20,
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