import "mocha";
import puppeteer from "puppeteer";
import { expect } from "chai";
import fs from "fs";
import { LabClient } from "../../../e2eTests/LabClient";

const SCREENSHOT_BASE_FOLDER_NAME = `${__dirname}/screenshots`;
let SCREENSHOT_NUM = 0;
let username = "";
let accountPwd = "";

function setupScreenshotDir() {
    if (!fs.existsSync(`${SCREENSHOT_BASE_FOLDER_NAME}`)) {
        fs.mkdirSync(SCREENSHOT_BASE_FOLDER_NAME);
    }
}

async function setupCredentials() {
    const testCreds = new LabClient();
    const envResponse = await testCreds.getUserVarsByCloudEnvironment("azureppe");
    const testEnv = envResponse[0];
    if (testEnv.upn) {
        username = testEnv.upn;
    }

    const testPwdSecret = await testCreds.getSecret(testEnv.labName);

    accountPwd = testPwdSecret.value;
}

async function takeScreenshot(page: puppeteer.Page, testName: string, screenshotName: string): Promise<void> {
    const screenshotFolderName = `${SCREENSHOT_BASE_FOLDER_NAME}/${testName}`
    if (!fs.existsSync(`${screenshotFolderName}`)) {
        fs.mkdirSync(screenshotFolderName);
    }
    await page.screenshot({ path: `${screenshotFolderName}/${++SCREENSHOT_NUM}_${screenshotName}.png` });
}

async function enterCredentials(page: puppeteer.Page, testName: string): Promise<void> {
    await page.waitForNavigation({ waitUntil: "networkidle0"});
    await page.waitForSelector("#i0116");
    await takeScreenshot(page, testName, `loginPage`);
    await page.type("#i0116", username);
    await page.click("#idSIButton9");
    await page.waitForNavigation({ waitUntil: "networkidle0"});
    await page.waitForSelector("#i0118");
    await takeScreenshot(page, testName, `pwdInputPage`);
    await page.type("#i0118", accountPwd);
    await page.click("#idSIButton9");
}

describe.skip("Browser tests", function () {
    this.timeout(0);
    this.retries(1);

    let browser: puppeteer.Browser;
    before(async () => {
        setupScreenshotDir();
        setupCredentials();
        browser = await puppeteer.launch({
            headless: true,
            ignoreDefaultArgs: ['--no-sandbox', '–disable-setuid-sandbox']
        });
    });

    let context: puppeteer.BrowserContext;
    let page: puppeteer.Page;
    beforeEach(async () => {
        SCREENSHOT_NUM = 0;
        context = await browser.createIncognitoBrowserContext();
        page = await context.newPage();
        await page.goto('http://localhost:30662/');
    });

    afterEach(async () => {
        await page.close();
    });

    after(async () => {
        await context.close();
        await browser.close();
    });

    it.skip("Performs loginRedirect and acquires 2 tokens", async () => {
        const testName = "multipleResources";
        // Home Page
        await takeScreenshot(page, testName, `samplePageInit`);
        // Click Sign In
        await page.click("#SignIn");
        await takeScreenshot(page, testName, `signInClicked`);
        // Click Sign In With Redirect
        await page.click("#loginRedirect");
        // Enter credentials
        await enterCredentials(page, testName);
        // Wait for return to page
        await page.waitForNavigation({ waitUntil: "networkidle0"});
        await takeScreenshot(page, testName, `samplePageLoggedIn`);
        let sessionStorage = await page.evaluate(() =>  Object.assign({}, window.sessionStorage));
        expect(Object.keys(sessionStorage).length).to.be.eq(4);

        // acquire First Access Token
        await page.click("#seeProfile");
        await page.waitFor(2000)
        await takeScreenshot(page, testName, `seeProfile`);
        sessionStorage = await page.evaluate(() =>  Object.assign({}, window.sessionStorage));
        expect(Object.keys(sessionStorage).length).to.be.eq(4);

        //acquire Second Access Token
        await page.click("#secondToken");
        await page.waitForSelector("#second-resource-div");
        await takeScreenshot(page, testName, `secondToken`);
        sessionStorage = await page.evaluate(() =>  Object.assign({}, window.sessionStorage));
        expect(Object.keys(sessionStorage).length).to.be.eq(4);
    });
});
