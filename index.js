const AWS = require('aws-sdk');
const launchChrome = require('@serverless-chrome/lambda');
const CDP = require('chrome-remote-interface');
const puppeteer = require('puppeteer');
const account = require('./account');

exports.handler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const query = {
    place: '東京',
    raceNo: '10',
    racerNo: '1',
    amount: '100',
  };
  if (event) {
    const inputParams = {
      place: event['place'],
      raceNo: event['raceNo'],
      racerNo: event['racerNo'],
      amount: event['amount'],
    };
    Object.assign(query, inputParams);
  }

  const amountRemoveTwoDigit = query.amount.replace(/00$/, '');

  let slsChrome = null;
  let browser = null;
  let page = null;

  try {
    // serverless-chromeを起動し、PuppeteerからWebSocketで接続する
    slsChrome = await launchChrome();
    browser = await puppeteer.connect({
      browserWSEndpoint: (await CDP.Version()).webSocketDebuggerUrl, // eslint-disable-line
    });

    page = await browser.newPage();

    await Promise.all([
      // 画面内にないものをクリックしようとするとイベントが発火しないため全画面表示される大きさに設定
      page.setViewport({width: 1920, height: 2000}),
      page.goto('https://www.ipat.jra.go.jp/'),
    ]);
    if ((await page.$('[name="inetid"]')) === null) {
      throw new Error('you can not buy');
    }

    await page.type('[name="inetid"]', account.INETID);
    await Promise.all([
      page.click('.button a'),
      page.waitForSelector('[name="i"]'),
    ]);
    if ((await page.$('[name="i"]')) === null) {
      throw new Error('inetid login error');
    }
    console.log('inetidを入力してログインしました');

    // input login
    await page.type('[name="i"]', account.USERID);
    await page.type('[name="p"]', account.PASSWORD);
    await page.type('[name="r"]', account.PARS);
    // submit
    await Promise.all([
      page.click('.buttonModern a'),
      page.waitForNavigation(),
    ]);
    // トップページの前にお知らせがある場合
    if (
      (await page.$('[ui-sref="bet.basic"]')) === null &&
      (await page.$('[ui-sref="home"]')) !== null
    ) {
      await Promise.all([
        page.click('[ui-sref="home"]'),
        page.waitForSelector('[ui-sref="bet.basic"]'),
      ]);
    }

    const betButton = await page.$('[ui-sref="bet.basic"]');
    if (betButton === null) {
      throw new Error('you can not buy');
    }
    // 未検証
    const betDisabled = await betButton.getProperty('disabled');
    if (await betDisabled.jsonValue()) {
      throw new Error('you can not buy');
    }

    await Promise.all([
      page.click('[ui-sref="bet.basic"]'),
      page.waitForSelector('.place-name'),
    ]);

    // 場所指定
    const placeItems = await page.$$('.place-name');
    if (placeItems === null) {
      throw new Error('login error');
    }
    console.log('ログインに成功しました');
    for (let placeItem of placeItems) {
      const placeNameTag = await placeItem.$('span');
      const placeNameText = await placeNameTag.getProperty('textContent');
      const placeName = await placeNameText.jsonValue();
      if (placeName.slice(0, 2) == query.place) {
        await Promise.all([
          placeItem.click(),
          page.waitForSelector('.race-no'),
        ]);
        break;
      }
    }

    // レース指定
    const raceItems = await page.$$('.race-no');
    if (raceItems === null) {
      throw new Error('place error');
    }
    console.log('開催場を指定しました');
    for (let raceItem of raceItems) {
      const raceNoTag = await raceItem.$('span');
      const raceNoText = await raceNoTag.getProperty('textContent');
      const raceNo = await raceNoText.jsonValue();
      if (raceNo == query.raceNo) {
        await Promise.all([
          raceItem.click(),
          page.waitForSelector('#bet-basic-type'),
        ]);
        break;
      }
    }

    // 式別指定
    const betTypeDropDown = await page.$('#bet-basic-type');
    const betItems = await betTypeDropDown.$$('option');
    if (betItems === null) {
      throw new Error('race error');
    }
    console.log('レース番号を指定しました');
    let betValue;
    for (let betItem of betItems) {
      const betItemNameLabel = await betItem.getProperty('label');
      const betItemName = await betItemNameLabel.jsonValue();
      if (betItemName == '複勝') {
        const betItemDropDownValue = await betItem.getProperty('value');
        betValue = await betItemDropDownValue.jsonValue();
        break;
      }
    }
    await Promise.all([
      page.select('#bet-basic-type', betValue),
      page.waitForSelector('.winplace-table'),
    ]);
    console.log('式別を指定しました');

    // 馬番指定
    const horseListTable = await page.$('.winplace-table');
    const horseNumberItems = await horseListTable.$$('tr');
    const mouse = page.mouse;
    let isSetRacer = false;
    for (let horseNumberItem of horseNumberItems) {
      const racerNoElement = await horseNumberItem.$('racer-no');
      if (racerNoElement == null) {
        continue;
      }
      const racerNoTag = await racerNoElement.$('span');
      const racerNoText = await racerNoTag.getProperty('textContent');
      const racerNo = await racerNoText.jsonValue();
      if (racerNo == query.racerNo) {
        const clickElement = await horseNumberItem.$('.racer-first');
        const rect = await clickElement.boundingBox();
        await Promise.all([
          mouse.move(parseFloat(rect.x + 20), parseFloat(rect.y + 20)),
          page.waitFor(1000),
          mouse.click(parseFloat(rect.x + 20), parseFloat(rect.y + 20), {
            button: 'left',
            clickCount: 1,
            delay: 0,
          }),
          page.waitForSelector('.selection-amount'),
        ]);
        isSetRacer = true;
        break;
      }
    }
    if (!isSetRacer) {
      throw new Error('racer error');
    }
    console.log('馬番を指定しました');

    // 金額指定
    const amountSection = await page.$('.selection-amount');
    const amountItem = await amountSection.$('input');
    await amountItem.focus();
    const amountRemoveTwoDigitArray = amountRemoveTwoDigit.split('');
    for (let amountRemoveTwoDigitString of amountRemoveTwoDigitArray) {
      await amountItem.press(amountRemoveTwoDigitString);
    }
    page.waitFor(1000);
    console.log('金額を指定しました');

    // 確定
    const setButtonSection = await page.$('.selection-buttons');
    const selectionButtons = await setButtonSection.$$('button');
    const setButton = selectionButtons[1];
    await Promise.all([setButton.click(), page.waitFor(3000)]);
    const completeButton = selectionButtons[2];
    await Promise.all([completeButton.click(), page.waitFor(3000)]);
    console.log('馬券をセットしました');

    // 購入
    const betConfirmBox = await page.$('#bet-list-top');
    const betConfirmBoxTable = await betConfirmBox.$('table');
    const betConfirmBoxTableRecords = await betConfirmBoxTable.$$('tr');
    const sumInput = await betConfirmBoxTableRecords[4].$('input');
    await sumInput.focus();
    const ammountArray = query.amount.split('');
    for (let ammountString of ammountArray) {
      await sumInput.press(ammountString);
    }
    const purchaceButton = await betConfirmBoxTableRecords[5].$('button');
    await Promise.all([
      purchaceButton.click(),
      page.waitForSelector('error-window'),
    ]);

    const commonConfirmBox = await page.$('error-window');
    const commonConfirmFooter = await commonConfirmBox.$('.dialog-footer');
    const confirmOkButton = await commonConfirmFooter.$('button');
    await Promise.all([confirmOkButton.click(), page.waitFor(3000)]);
    console.log('馬券を購入しました');

    return callback(null, JSON.stringify({result: 'OK'}));
  } catch (err) {
    console.error(err);
    return callback(null, JSON.stringify({result: 'NG'}));
  } finally {
    if (page) {
      await page.close();
    }

    if (browser) {
      await browser.disconnect();
    }

    if (slsChrome) {
      await slsChrome.kill();
    }
  }
};
