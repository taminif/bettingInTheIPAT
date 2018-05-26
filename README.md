# bettingInTheIPAT
IPATで馬券購入するプログラムです。  
ローカルビルド、およびAWS Lambdaで動作します。  
Headless Chrome, puppeteerを使用しています。

## 動作環境
Node6.10

## 実行方法
1. リポジトリをcloneし、プロジェクトに移動してライブラリをダウンロードします。
```
cd bettingInTheIPAT
npm install
```

2. src/account.jsにアカウント情報を設定します。

3. localで実行します。
```
SLOWMO_MS=250 npm run local
```

4. AWS Lambdaで実行する場合はzipに圧縮し、アップロードします。
```
npm run package
```

## 謝辞
AWS Lambdaで動作させるため、puppeteer-lambda-starter-kitを使用させていただきました。
https://github.com/sambaiz/puppeteer-lambda-starter-kit

## License
MIT License
