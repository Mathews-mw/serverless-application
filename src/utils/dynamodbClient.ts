import { DynamoDB } from 'aws-sdk';

const options = {
  region: 'localhost',
  endpoint: 'http://localhost:8000',
  accessKeyId: 'x', //para usar o dynamo localmente sem as credenciais da aws
  secretAccessKey: 'x'
};

const isOffline = () => {
  return process.env.IS_OFFLINE;
}

export const document = isOffline() 
  ? new DynamoDB.DocumentClient(options) 
  : new DynamoDB.DocumentClient();