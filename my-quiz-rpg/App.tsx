// App.tsx
// React Native + TypeScript starter for "Quiz RPG" idea (single-file starter you can drop into an Expo TypeScript project)

import React, { useEffect, useReducer } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";

// -----------------------------
// Types
// -----------------------------

type Question = {
  id: string;
  text: string;
  choices: string[];
  answerIndex: number;
  xpReward?: number;
  damageToEnemy?: number;
};

type Player = {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  gold: number;
};

type Enemy = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  level: number;
};

type State = {
  player: Player;
  enemy: Enemy | null;
  currentQuestionIndex: number;
  questions: Question[];
  inBattle: boolean;
};

type Action =
  | { type: "ANSWER"; payload: { correct: boolean; choiceIndex: number } }
  | { type: "START_BATTLE" }
  | { type: "RESET" };

// -----------------------------
// Sample questions (conhecimento geral)
// -----------------------------

const SAMPLE_QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "Qual é o maior planeta do sistema solar?",
    choices: ["Terra", "Júpiter", "Marte", "Saturno"],
    answerIndex: 1,
    xpReward: 10,
    damageToEnemy: 20,
  },
  {
    id: "q2",
    text: "Quem escreveu 'Dom Quixote'?",
    choices: ["José de Alencar", "Cervantes", "Machado de Assis", "Camões"],
    answerIndex: 1,
    xpReward: 12,
    damageToEnemy: 20,
  },
  {
    id: "q3",
    text: "Qual é a capital do Canadá?",
    choices: ["Toronto", "Vancouver", "Montreal", "Ottawa"],
    answerIndex: 3,
    xpReward: 15,
    damageToEnemy: 20,
  },
  {
    id: "q4",
    text: "Em que continente fica o Egito?",
    choices: ["África", "Ásia", "Europa", "América"],
    answerIndex: 0,
    xpReward: 8,
    damageToEnemy: 20,
  },
  {
    id: "q5",
    text: "Qual elemento químico tem o símbolo 'O'?",
    choices: ["Ouro", "Oxigênio", "Ósmio", "Ozônio"],
    answerIndex: 1,
    xpReward: 10,
    damageToEnemy: 20,
  },
  {
    id: "q6",
    text: "Quantos lados tem um hexágono?",
    choices: ["Cinco", "Seis", "Sete", "Oito"],
    answerIndex: 1,
    xpReward: 6,
    damageToEnemy: 20,
  },
];

// -----------------------------
// Helpers
// -----------------------------

function createEnemyForQuestion(q: Question, idx: number): Enemy {
  const baseHp = 100; // fixo para simplificar
  return {
    id: `enemy_${q.id}`,
    name: `Inimigo Nível ${1 + idx}`,
    hp: baseHp,
    maxHp: baseHp,
    level: 1 + idx,
  };
}

function xpToNextLevel(level: number) {
  return 20 + level * 10;
}

// -----------------------------
// Reducer
// -----------------------------

const initialState = (): State => ({
  player: { hp: 120, maxHp: 120, xp: 0, level: 1, gold: 0 },
  enemy: null,
  currentQuestionIndex: 0,
  questions: SAMPLE_QUESTIONS,
  inBattle: false,
});

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_BATTLE": {
      const q = state.questions[state.currentQuestionIndex];
      const enemy = createEnemyForQuestion(q, state.currentQuestionIndex);
      return { ...state, enemy, inBattle: true };
    }

    // trechos principais alterados

    case "ANSWER": {
      if (!state.inBattle || !state.enemy) return state;
      const q = state.questions[state.currentQuestionIndex];
      const correct = action.payload.correct;

      if (correct) {
        const dmg = q.damageToEnemy ?? 20;
        const newEnemyHp = Math.max(0, state.enemy.hp - dmg);
        const playerAfter = { ...state.player };
        playerAfter.xp += q.xpReward ?? 5;

        const nextXp = xpToNextLevel(playerAfter.level);
        if (playerAfter.xp >= nextXp) {
          playerAfter.level += 1;
          playerAfter.maxHp += 20;
          playerAfter.hp = playerAfter.maxHp;
          playerAfter.xp = playerAfter.xp - nextXp;
        }

        let newState: State = {
          ...state,
          player: playerAfter,
          enemy: { ...state.enemy, hp: newEnemyHp },
        };

        // avança para a próxima pergunta SEMPRE que acertar
        const nextIndex = state.currentQuestionIndex + 1;

        if (nextIndex < state.questions.length) {
          newState.currentQuestionIndex = nextIndex;
        } else {
          // acabou as perguntas → termina batalha ou jogo
          newState.inBattle = false;
          newState.enemy = null;
        }

        if (newEnemyHp <= 0) {
          // inimigo derrotado → recompensa
          const goldGained = 10 + state.currentQuestionIndex * 5;
          newState.player.gold += goldGained;
          newState.inBattle = false;
          newState.enemy = null;
        }

        return newState;
      } else {
        const damageToPlayer = 15 + (state.enemy.level - 1) * 5;
        const newHp = Math.max(0, state.player.hp - damageToPlayer);
        const newPlayer = { ...state.player, hp: newHp };
        const newState = { ...state, player: newPlayer };
        if (newHp <= 0) {
          newState.inBattle = false;
          newState.enemy = null;
        }
        return newState;
      }
    }

    case "RESET":
      return initialState();

    default:
      return state;
  }
}

// -----------------------------
// UI Components
// -----------------------------

function HUD({ player }: { player: Player }) {
  return (
    <View style={styles.hud}>
      <View>
        <Text style={styles.hudText}>Player</Text>
        <Text>
          HP: {player.hp}/{player.maxHp}
        </Text>
        <Text>
          Level: {player.level} • XP: {player.xp}/{xpToNextLevel(player.level)}
        </Text>
        <Text>Gold: {player.gold}</Text>
      </View>
    </View>
  );
}

function QuestionCard({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (choiceIndex: number) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.questionText}>{question.text}</Text>
      <FlatList
        data={question.choices}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.choice}
            onPress={() => onAnswer(index)}
            activeOpacity={0.7}
          >
            <Text style={{ color: "#1a202c" }}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// -----------------------------
// Main App
// -----------------------------

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    if (
      !state.inBattle &&
      state.enemy === null &&
      state.currentQuestionIndex < state.questions.length
    ) {
      dispatch({ type: "START_BATTLE" });
    }
  }, [
    state.inBattle,
    state.enemy,
    state.currentQuestionIndex,
    state.questions.length,
  ]);

  const currentQuestion = state.questions[state.currentQuestionIndex];

  useEffect(() => {
    if (
      !state.inBattle &&
      state.enemy === null &&
      state.currentQuestionIndex >= state.questions.length
    ) {
      Alert.alert("Parabéns!", "Você completou todas as perguntas!", [
        { text: "Resetar", onPress: () => dispatch({ type: "RESET" }) },
      ]);
    }
  }, [
    state.inBattle,
    state.enemy,
    state.currentQuestionIndex,
    state.questions.length,
  ]);

  function handleAnswer(choiceIndex: number) {
    if (!currentQuestion) return;
    const correct = choiceIndex === currentQuestion.answerIndex;
    dispatch({ type: "ANSWER", payload: { correct, choiceIndex } });
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Quiz RPG — Conhecimento Geral</Text>

      <HUD player={state.player} />

      {currentQuestion ? (
        <QuestionCard question={currentQuestion} onAnswer={handleAnswer} />
      ) : (
        <View style={styles.centerBox}>
          <Text>Fim do Quiz!</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => dispatch({ type: "RESET" })}
          >
            <Text style={styles.buttonText}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={{ fontSize: 12, color: "#4a5568" }}>
          Dica: acerte para avançar para a próxima pergunta!
        </Text>
      </View>
    </SafeAreaView>
  );
}

// -----------------------------
// Styles
// -----------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#edf2f7",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c5282",
    textAlign: "center",
    marginBottom: 12,
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#e2e8f0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  hudText: { color: "#2c5282", fontWeight: "700" },
  card: {
    backgroundColor: "#f7fafc",
    padding: 14,
    borderRadius: 10,
    flex: 1,
  },
  questionText: {
    color: "#2d3748",
    fontSize: 18,
    marginBottom: 12,
  },
  choice: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#e6fffa",
    marginBottom: 8,
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#4299e1",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  footer: { padding: 8, alignItems: "center" },
});
