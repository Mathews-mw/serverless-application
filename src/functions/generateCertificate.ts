import { join } from "path";
import { readFileSync } from "fs";
import Handlebars from "handlebars";
import { APIGatewayProxyHandler } from "aws-lambda"
import { S3 } from 'aws-sdk';

import { document } from "../utils/dynamodbClient";
import dayjs from "dayjs";
import Chromium from "chrome-aws-lambda";

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate {
  id: string;
  name: string;
  grade: string;
  date: string;
  medal: string;
}

const compileTemplate = async (data: ITemplate) => {
                        //process.cwd() indica que iremos partir da raiz do projeto.
  const filePath = join(process.cwd(), "src", "templates", "certificate.hbs");

  const html = readFileSync(filePath, "utf-8");

  return  Handlebars.compile(html)(data);
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;
  
  const result = await document.query({
    TableName: 'users_certificate',
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': id
    }
  }).promise();

  const userAlreadyExists = result.Items[0];

  if (!userAlreadyExists) {
    await document.put({
      TableName: 'users_certificate',
      Item: {
        id,
        name,
        grade,
        created_at: new Date().getTime()
      }
    }).promise();
  }

  const medalPath = join(process.cwd(), 'src', 'templates', 'selo.png');
  const medal = readFileSync(medalPath, 'base64');

  const data: ITemplate = {
    name,
    id,
    grade,
    date: dayjs().format('DD/MM/YYYY'),
    medal
  }

  const content = await compileTemplate(data);

  const browser = await Chromium.puppeteer.launch({
    args: Chromium.args,
    defaultViewport: Chromium.defaultViewport,
    executablePath: await Chromium.executablePath,
    userDataDir: '/dev/null'
  });

  const page = await browser.newPage();
  await page.setContent(content);
  
  const pdf = await page.pdf({
    format: 'a4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    path: process.env.IS_OFFLINE ? './certificate.pdf' : null
  });

  await browser.close();

  const s3 = new S3()

  await s3.putObject({
    Bucket: 'mw-s3-storage',
    Key: `${id}.pdf`,
    ACL: 'public-read-write',
    Body: pdf,
    ContentType: 'application/pdf'
  }).promise();

  
  return {
    statusCode: 201,
    body: JSON.stringify({ message: 'Certificado gerado com sucesso' })
  }
}