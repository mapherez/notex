# Configuração Google do NoteX

Preencher `src/config/google.json` quando o projeto Google estiver disponível:

```json
{
  "webClientId": "CLIENT_ID_WEB.apps.googleusercontent.com",
  "desktopClientId": "CLIENT_ID_DESKTOP.apps.googleusercontent.com",
  "webOrigin": "https://ENDERECO-DA-WEBAPP"
}
```

Estes valores são públicos. Não colocar passwords, access tokens, refresh tokens ou client secrets neste ficheiro. A configuração é incorporada no build; reconstruir a aplicação depois de a alterar.

## Google Cloud

1. Criar um projeto e ativar a Google Drive API.
2. Configurar o consentimento OAuth e, durante testes, adicionar as contas de teste.
3. Criar um cliente OAuth do tipo **Desktop app** e outro **Web application**, no mesmo projeto.
4. No cliente web, autorizar a origem HTTPS exata e a origem de desenvolvimento usada (por exemplo `http://localhost:5173`).
5. Configurar os scopes `openid`, `email`, `profile` e `https://www.googleapis.com/auth/drive.appdata`.
6. Preencher os IDs e a origem no ficheiro acima. O fluxo web usa popup e acesso direto à Google, sem backend de sessões.

Credenciais em modo de teste podem ter limitações de duração impostas pela Google. Antes de distribuir, rever o estado de publicação e os requisitos atuais de consentimento no projeto Google.

Até haver configuração e contas de teste, a integração real com Google não pode ser validada. Os testes locais de armazenamento e as simulações de rede continuam independentes desta configuração.
