import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
// const path = require('Path');
import { createEdgeRouter } from "next-connect";
import fs from 'fs';
import decompress from 'decompress';
import * as fsX from 'fs-extra';
import { exec, ExecException } from 'child_process'
import path from 'path';
import { memo } from 'react';
import { generateAsync } from 'jszip';

//SETUP FOR NEXT-CONNECT ROUTER
interface RequestContext {
  params: {
    id: string;
  };
}

type memObject = Record<string, string | number>;
const memory: memObject = {};

const ports: number[] = [9090, 16686, 14268, 14250, 9411, 1888, 8888, 8889, 13133, 4317, 4318, 55679];

//NEXT-CONNECT ROUTER
const router = createEdgeRouter<NextRequest, RequestContext>();

router
  //FILE CLEANUP
  .post(async (req, event, next) => {
    fsX.emptyDirSync('./test/zip');
    fsX.emptyDirSync('./test/unzip');
    return next()
  })

  //CREATE ZIP
  .post(async (req, event, next) => {
    const blobZip = await req.blob()
    const fileBuffer: any = await blobZip.arrayBuffer()
    const data = new DataView(fileBuffer);
    fs.writeFileSync('test/zip/files.zip', data);
    return next()
  })

  /* UNPACK ZIP FILE */
  .post(async (req, event, next) => {
    await decompress('test/zip/files.zip', 'test/unzip');
    fsX.emptyDirSync('test/zip');
    fs.rmdirSync('test/zip')

    // save name of App
    memory.appname = fs.readdirSync('test/unzip')[0];
    console.log('appname', memory.appname);

    return next()
  })

  // DOCKER PROCESS

  // ADD DOCKERFILE, .DOCKERIGNORE, AND INSTRUMENTATION FILE
  .post(async (req, event, next) => {

    console.log('added dockerfile and dockerignore')
    console.log('memory.appname', memory.appname);

    const newAppPath: string = `test/unzip/${memory.appname}`;
    const dockerFilePath: string = `${newAppPath}/Dockerfile.user`;

    memory.newAppPath = newAppPath;
    memory.dockerFilePath = dockerFilePath;

    fs.cp('Dockerfile.template', `${newAppPath}/Dockerfile.user`, err => {
      if (err) console.log('error while adding Dockerfile: ', err);
    })

    fs.cp('.dockerignore', `${newAppPath}/.dockerignore`, err => {
      if (err) console.log('error while adding Dockerfile: ', err);
    })

    fs.cp('instrumentation.txt', `${newAppPath}/app/instrumentation.ts`, err => {
      if (err) console.log('error while adding Dockerfile: ', err);
    })

    return next();
  })

  // BUILD AND DEPLOY DOCKER CONTAINER AT RANDOMIZED PORT
  .post(async (req, event, next) => {

    const generatePort = (): number => Math.round(Math.random() * 10000 + 1000);

    let bool = true;
    while (bool) {
      const port = generatePort();
      if (ports.includes(port)) continue;
      else {
        ports.push(port)
        bool = false;
      };
    }

    // assign port name and save to memory
    const port = ports[ports.length - 1];
    memory[`${memory.appname}`] = port;
    console.log('ports array: ', ports);
    console.log('new port: ', port);

    const dockerSetup: string = `
    docker build -f ${memory.dockerFilePath} -t ${memory.appname} ${memory.newAppPath}
    docker run -d -p ${port}:3000 ${memory.appname}
    `;


    // Build Docker Image and Run Docker Container on Port 4000
    exec(dockerSetup, (error: ExecException | null, stdout: string, stderr: string): void => {
      if (error !== null) {
        console.log(error);
      } else {
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
      }
    });

    // delete local directory once docker is setUp
    // fsX.emptyDir('test');

    return NextResponse.json('Files successfully loaded');
    // return next()
  })


export async function POST(request: NextRequest, ctx: RequestContext) {
  return router.run(request, ctx);
}