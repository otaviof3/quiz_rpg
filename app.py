import google.generativeai as genai
import json
import os
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
import sys

# Forçar UTF-8
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Carregar variáveis de ambiente
load_dotenv()

# Configurar API do Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY não configurada. Adicione ao arquivo .env")

genai.configure(api_key=GEMINI_API_KEY)

# Inicializar Flask
app = Flask(__name__)
CORS(app)

# Armazenamento em memória (para produção, usar banco de dados)
user_stats = {}

def gerar_pergunta():
    """Gera uma pergunta de múltipla escolha usando Gemini"""
    prompt = """Gere EXATAMENTE uma pergunta de conhecimento geral de múltipla escolha em JSON válido.
    
    Retorne APENAS este JSON, sem nenhuma outra texto antes ou depois:
    {
        "id": 1,
        "pergunta": "Qual é a capital da França?",
        "opcoes": ["Paris", "Lyon", "Marselha", "Toulouse"],
        "resposta_correta": 0,
        "dificuldade": "fácil",
        "categoria": "geografia"
    }
    
    IMPORTANTE:
    - Retorne SOMENTE o JSON, nada mais
    - A resposta correta deve ser um índice entre 0-3
    - Dificuldade: fácil, médio ou difícil
    - Sem markdown, sem explicações, sem textos adicionais
    """
    
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=500
            )
        )
        
        texto = response.text.strip()
        print(f"DEBUG - Resposta bruta: {texto[:200]}")  # Log para debug
        
        # Limpar resposta de possível formatação markdown
        if texto.startswith("```json"):
            texto = texto[7:]
        elif texto.startswith("```"):
            texto = texto[3:]
        
        if texto.endswith("```"):
            texto = texto[:-3]
        
        texto = texto.strip()
        
        # Encontrar o JSON se houver texto extra
        inicio = texto.find('{')
        fim = texto.rfind('}') + 1
        if inicio != -1 and fim > inicio:
            texto = texto[inicio:fim]
        
        pergunta_data = json.loads(texto)
        print(f"DEBUG - JSON parseado com sucesso")
        return pergunta_data
    
    except json.JSONDecodeError as e:
        print(f"❌ Erro ao parsear JSON: {e}")
        print(f"Texto recebido: {texto}")
        return None
    except Exception as e:
        print(f"❌ Erro ao gerar pergunta: {e}")
        import traceback
        traceback.print_exc()
        return None

@app.route("/api/pergunta", methods=["GET"])
def obter_pergunta():
    """Endpoint para obter uma nova pergunta"""
    print("🔄 Tentando gerar pergunta...")
    pergunta = gerar_pergunta()
    
    if pergunta:
        print(f"✅ Pergunta gerada: {pergunta['pergunta'][:50]}...")
        return jsonify({
            "sucesso": True,
            "pergunta": pergunta
        })
    else:
        print("❌ Falha ao gerar pergunta")
        return jsonify({
            "sucesso": False,
            "erro": "Falha ao gerar pergunta com Gemini",
            "dica": "Verifique a GEMINI_API_KEY no arquivo .env"
        }), 500

@app.route("/api/verificar-resposta", methods=["POST"])
def verificar_resposta():
    """Endpoint para verificar se a resposta está correta"""
    try:
        dados = request.get_json(force=True)
    except Exception as e:
        print(f"Erro ao parsear JSON: {e}")
        # Tenta com encoding manual
        dados = request.json
    pergunta = dados.get("pergunta")
    resposta_usuario = dados.get("resposta")
    usuario_id = dados.get("usuario_id", "anonimo")
    
    if pergunta is None or resposta_usuario is None:
        return jsonify({
            "sucesso": False,
            "erro": "Dados incompletos"
        }), 400
    
    resposta_correta = pergunta.get("resposta_correta")
    acertou = resposta_usuario == resposta_correta
    
    # Calcular dano/cura
    dano_ao_inimigo = 0
    dano_ao_usuario = 0
    xp_ganho = 0
    
    if acertou:
        # Acerto: dano aumenta com dificuldade
        dificuldade = pergunta.get("dificuldade", "médio")
        dano_map = {"fácil": 5, "médio": 10, "difícil": 20}
        dano_ao_inimigo = dano_map.get(dificuldade, 10)
        xp_ganho = dano_map.get(dificuldade, 10) * 2
    else:
        # Erro: dano ao usuário
        dano_ao_usuario = 5
    
    # Atualizar stats do usuário
    if usuario_id not in user_stats:
        user_stats[usuario_id] = {
            "level": 1,
            "xp": 0,
            "hp": 100,
            "xp_para_proximo": 100
        }
    
    stats = user_stats[usuario_id]
    stats["xp"] += xp_ganho
    stats["hp"] -= dano_ao_usuario
    
    # Verificar level up
    level_up = False
    while stats["xp"] >= stats["xp_para_proximo"]:
        stats["level"] += 1
        stats["xp"] -= stats["xp_para_proximo"]
        stats["xp_para_proximo"] = int(stats["xp_para_proximo"] * 1.5)
        stats["hp"] = 100  # Recupera HP ao evoluir
        level_up = True
    
    return jsonify({
        "sucesso": True,
        "acertou": acertou,
        "resposta_correta": resposta_correta,
        "dano_ao_inimigo": dano_ao_inimigo,
        "dano_ao_usuario": dano_ao_usuario,
        "xp_ganho": xp_ganho,
        "level_up": level_up,
        "stats": stats
    })

@app.route("/api/stats/<usuario_id>", methods=["GET"])
def obter_stats(usuario_id):
    """Endpoint para obter stats do usuário"""
    if usuario_id not in user_stats:
        user_stats[usuario_id] = {
            "level": 1,
            "xp": 0,
            "hp": 100,
            "xp_para_proximo": 100
        }
    
    return jsonify({
        "sucesso": True,
        "stats": user_stats[usuario_id]
    })

@app.route("/api/reset/<usuario_id>", methods=["POST"])
def resetar_stats(usuario_id):
    """Endpoint para resetar stats do usuário"""
    user_stats[usuario_id] = {
        "level": 1,
        "xp": 0,
        "hp": 100,
        "xp_para_proximo": 100
    }
    
    return jsonify({
        "sucesso": True,
        "mensagem": "Stats resetadas",
        "stats": user_stats[usuario_id]
    })

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)