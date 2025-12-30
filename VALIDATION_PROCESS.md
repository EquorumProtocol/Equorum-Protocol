# Processo de Validação - Faucet Challenge

## 🔍 Como Validar Provas

### Checklist de Validação

Para cada prova postada em #✅-provas, verificar:

1. **Endereço da Carteira**
   - [ ] Endereço válido (0x... com 42 caracteres)
   - [ ] Não está na lista de já recompensados

2. **Transação de Stake**
   - [ ] Link válido do Arbiscan
   - [ ] Transação confirmada (não pending)
   - [ ] Função chamada: `stake`
   - [ ] Valor >= 50 EQM (50000000000000000000 wei)
   - [ ] Contrato correto: 0xf7DB92f37308A19b0C985775d414789f2B9ecAf2

3. **Saldo no Staking**
   - [ ] Print ou link mostrando saldo
   - [ ] Verificar no contrato: função `stakes(endereço)`
   - [ ] Saldo >= 50 EQM

### Como Verificar no Arbiscan

1. **Verificar Transação de Stake:**
   ```
   - Abra o link da TX fornecido
   - Verifique Status: Success
   - Verifique To: 0xf7DB92f37308A19b0C985775d414789f2B9ecAf2 (Staking)
   - Verifique Function: stake
   - Verifique Input Data: amount >= 50 EQM
   ```

2. **Verificar Saldo Atual:**
   ```
   - Acesse: https://arbiscan.io/address/0xf7DB92f37308A19b0C985775d414789f2B9ecAf2#readContract
   - Encontre função: stakes
   - Input: endereço do usuário
   - Verifique retorno >= 50000000000000000000
   ```

---

## 💰 Como Enviar Recompensa

### Passo a Passo

1. **Confirmar Validação**
   - Todos os checks acima passaram
   - Usuário não está duplicado

2. **Enviar 100 EQM**
   ```
   - Acesse: https://arbiscan.io/address/0xc735AbB9121A1eEdAAfB7D86AA4472c48e23cAB0#writeContract
   - Conecte carteira do tesouro
   - Função: transfer
   - to: [endereço do usuário]
   - amount: 100000000000000000000 (100 EQM em wei)
   - Confirme transação
   ```

3. **Registrar no Tracking**
   - Adicione à planilha de Genesis Stakers
   - Atualize contador (X/10 recompensas distribuídas)

4. **Responder no Discord**
   ```
   🎉 Parabéns @[user]! 

   Validei sua prova. Você é o Genesis Staker #[número]!

   ✅ Recompensa de 100 EQM enviada!
   TX: https://arbiscan.io/tx/[hash]
   
   ✅ Cargo "Genesis Staker" adicionado
   ✅ Seu nome vai para a lista oficial

   Agora me diz: o que achou do processo? Teve alguma dificuldade?
   ```

5. **Adicionar Cargo no Discord**
   - Clique com botão direito no usuário
   - Roles → Adicionar "Genesis Staker"

---

## 📊 Tracking Sheet

### Planilha de Genesis Stakers

Crie uma planilha (Google Sheets ou Excel) com:

| # | Discord User | Wallet Address | Stake TX | Reward TX | Data | Status |
|---|--------------|----------------|----------|-----------|------|--------|
| 1 | @user1 | 0x... | arbiscan.io/tx/... | arbiscan.io/tx/... | 29/12 | ✅ Pago |
| 2 | @user2 | 0x... | arbiscan.io/tx/... | arbiscan.io/tx/... | 29/12 | ✅ Pago |

### Campos:
- **#**: Número do Genesis Staker (1-20)
- **Discord User**: Nome no Discord
- **Wallet Address**: Endereço da carteira
- **Stake TX**: Link da transação de stake
- **Reward TX**: Link da transação de recompensa
- **Data**: Data de conclusão
- **Status**: Pendente / Validado / Pago

---

## 🚨 Casos Especiais

### Stake Menor que 50 EQM
```
Opa @[user]! Vi que você fez stake, mas precisa ser de pelo menos 50 EQM para o desafio.

Você fez stake de [valor] EQM. Quer fazer mais um stake para completar os 50 EQM?

Qualquer dúvida, estou aqui!
```

### Prova Incompleta
```
Fala @[user]! Recebi sua prova, mas está faltando:

[ ] Link da transação de stake
[ ] Print do saldo no staking
[ ] Endereço da carteira

Pode completar? Assim consigo validar e enviar sua recompensa!
```

### Endereço Duplicado
```
Opa @[user]! Vi que esse endereço já recebeu recompensa.

O desafio é 1 recompensa por carteira. Mas você ainda pode participar e fazer stake normalmente!

Qualquer dúvida, me chama!
```

### Transação Pending
```
Vi sua prova @[user]! Mas a transação ainda está pending.

Assim que confirmar na blockchain, eu valido e envio sua recompensa!

Geralmente confirma em 1-2 minutos. Me avisa quando confirmar!
```

---

## 📈 Atualização Diária

### No canal #📊-status, poste diariamente:

```
**FAUCET CHALLENGE - DIA [X]/7**

🎯 Meta: 20 Genesis Stakers
📊 Progresso: [X]/20 (XX%)
💰 Recompensas: [X]/10 distribuídas

**HOJE:**
- [X] novos Genesis Stakers
- [X] recompensas enviadas
- Total de EQM em stake: [X] EQM

**ÚLTIMOS GENESIS STAKERS:**
#[N] - @user - [valor] EQM
#[N-1] - @user - [valor] EQM

**PRÓXIMO OBJETIVO:** [X] Genesis Stakers até amanhã!

Quer participar? Veja #🎮-faucet-challenge
```

---

## ✅ Checklist Diário

```
[ ] Verificar novas provas em #✅-provas
[ ] Validar e enviar recompensas pendentes
[ ] Responder dúvidas em #💬-ajuda-faucet
[ ] Atualizar planilha de tracking
[ ] Postar status diário em #📊-status
[ ] Responder feedback dos participantes
[ ] Ajustar processo se necessário
```

---

## 💡 Dicas de Engajamento

### Quando alguém completar:
1. Parabenize publicamente
2. Pergunte sobre a experiência
3. Ofereça ajuda com governança
4. Peça feedback específico

### Quando alguém travar:
1. Responda rápido (< 1h)
2. Seja específico na solução
3. Ofereça fazer junto (screen share se necessário)
4. Documente o problema para melhorar o guia

### Quando atingir marcos:
- 5 Genesis Stakers → Post no Twitter
- 10 Genesis Stakers → Post no Twitter + Reddit
- 15 Genesis Stakers → Anunciar meta quase batida
- 20 Genesis Stakers → Celebração + retrospectiva

---

## 🎯 Métricas de Sucesso

### Acompanhar:
- Tempo médio para completar desafio
- Taxa de conversão (visitantes → completaram)
- Principais dificuldades reportadas
- Feedback sobre o processo
- Retenção (quantos continuam com stake após 7 dias)

### Ajustar baseado em:
- Se ninguém completa em 24h → Simplificar processo
- Se muitos travam no mesmo passo → Melhorar documentação
- Se feedback é negativo → Ouvir e iterar
- Se meta não é atingida → Aumentar divulgação

---

**Lembre-se: Você é o anfitrião. Cada pessoa que completa é uma conquista.**
