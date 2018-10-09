# bettingInTheIPAT
IPATで馬券購入するプログラムです。  
ローカルビルド、およびAWS Lambdaで動作します。  
Headless Chrome, puppeteerを使用しています。

## 動作環境
Node8.10

## 実行方法
1. リポジトリをcloneし、プロジェクトに移動してライブラリをダウンロードします。
```
cd bettingInTheIPAT
npm install
```

2. src/account.jsにアカウント情報を設定します。

3. AWS Lambdaで実行するためにzipに圧縮し、アップロードします。
```
npm run zip
```

## License
MIT License
