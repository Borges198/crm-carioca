import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import datetime

# 1. INICIALIZAR O FIREBASE
# Certifique-se de que o arquivo .json está na mesma pasta do script
cred = credentials.Certificate("firebase_credentials.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# 2. CONFIGURAÇÕES DE VALORES DE MILHEIROS
VALOR_MILHEIRO = {
    "Azul": 16.00,
    "Smiles": 17.00,
    "Latam": 27.00
}

def calcular_valor_passagem(pontos, companhia, taxa_embarque):
    """
    Calcula o valor da passagem.
    Assume que 'pontos' é o total cheio (ex: 17890).
    """
    if companhia not in VALOR_MILHEIRO:
        raise ValueError("Companhia inválida. Escolha entre Azul, Smiles ou Latam.")
    
    # Transforma pontos em milheiros (divide por 1000)
    milheiros = pontos / 1000 
    
    # Calcula o custo dos pontos e soma a taxa
    custo_pontos = milheiros * VALOR_MILHEIRO[companhia]
    valor_final = custo_pontos + taxa_embarque
    
    return valor_final, custo_pontos

def salvar_cotacao_firebase(nome_cliente, origem, destino, data_ida, data_volta, companhia, valor_final):
    """
    Salva os dados da cotação no banco de dados Firestore.
    """
    cotacao = {
        "cliente": nome_cliente,
        "origem": origem,
        "destino": destino,
        "data_ida": data_ida,
        "data_volta": data_volta, # Pode ser 'Apenas Ida' se o cliente não quiser volta
        "companhia": companhia,
        "valor_final_reais": valor_final,
        "data_registro": datetime.datetime.now()
    }
    
    # Salva na coleção 'cotacoes'
    db.collection("cotacoes").add(cotacao)
    print("\n[✔] Cotação salva no Firebase com sucesso!")

def gerar_mensagem_whatsapp(nome, companhia, pontos, custo_pontos, taxa_embarque, valor_final):
    """
    Gera o texto padronizado para enviar no WhatsApp.
    """
    mensagem = (
        f"Cotação {nome}\n"
        f"Companhia: {companhia}\n"
        f"Valor por pessoa: ({pontos/1000:.2f} milheiros × R$ {VALOR_MILHEIRO[companhia]:.2f} + R$ {taxa_embarque:.2f})\n"
        f"Total: R$ {valor_final:.2f}\n"
        f"\n*Segue o print com os horários e informações do voo abaixo:*"
    )
    return mensagem

# ==========================================
# 3. ÁREA DE EXECUÇÃO (COMO VOCÊ VAI USAR)
# ==========================================
if __name__ == "__main__":
    print("=== SISTEMA DA AGENTE DE VIAGENS ===")
    
    # Coletando dados do cliente
    cliente = input("Nome do Cliente: ")
    origem = input("Origem (Ex: SSA): ")
    destino = input("Destino (Ex: CGH): ")
    data_ida = input("Data/Período de Ida (Ex: 19-05-2026): ")
    data_volta = input("Data/Período de Volta (Deixe em branco se for só ida): ")
    if not data_volta:
        data_volta = "Apenas Ida"
        
    print("\nCompanhias disponíveis: Azul, Smiles, Latam")
    companhia = input("Qual a companhia do melhor preço? ")
    
    # Coletando valores para o cálculo
    # Exemplo: se custa 17.890 pontos, digite 17890
    pontos = float(input("Quantidade total de pontos da passagem: ")) 
    taxa = float(input("Valor da taxa de embarque (R$): "))

    # Processamento
    try:
        valor_total, custo_pontos = calcular_valor_passagem(pontos, companhia, taxa)
        
        # Exibe a mensagem pronta
        print("\n=== MENSAGEM PARA COPIAR PARA O WHATSAPP ===")
        msg_pronta = gerar_mensagem_whatsapp(cliente, companhia, pontos, custo_pontos, taxa, valor_total)
        print(msg_pronta)
        print("============================================")
        
        # Salva no banco de dados
        salvar_cotacao_firebase(cliente, origem, destino, data_ida, data_volta, companhia, valor_total)
        
    except Exception as e:
        print(f"\n[X] Erro ao processar: {e}")