import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value, NodeState } from "../types";
import {delay} from "../utils";
import * as console from "console";
import axios from 'axios';

export async function node(
  nodeId: number, // the ID of the node
  N: number, // total number of nodes in the network
  F: number, // number of faulty nodes in the network
  initialValue: Value, // initial value of the node
  isFaulty: boolean, // true if the node is faulty, false otherwise
  nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
  setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  // node state
  let messagesR: Map<number, any[]> = new Map();
  let messagesP: Map<number, any[]> = new Map();

  let nodeState: NodeState = {
    killed: false,
    x: null,
    decided: null,
    k: null,
  };

  // TODO implement this
  // this route allows retrieving the current status of the node
  // node.get("/status", (req, res) => {});
  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  });

  // TODO implement this
  // this route allows the node to receive messages from other nodes
  // node.post("/message", (req, res) => {});
  node.post("/message", async (req, res) => {
    let { k, x, messageType } = req.body;
    if (!isFaulty && !nodeState.killed) {
      if (messageType == "R") {
        if (!messagesR.has(k)) {
          messagesR.set(k, []);
        }
        messagesR.get(k)!.push(x);
        let messageR = messagesR.get(k)!;
        if (messageR.length >= N - F) {
          let count0 = messageR.filter((el) => el == 0).length;
          let count1 = messageR.filter((el) => el == 1).length;
          let newX = "?"; // default
          if (count0 > N / 2) {
            newX = "0";
          } else if (count1 > N / 2) {
            newX = "1";
          }
          for (let i = 0; i < N; i++) {
            if (!messagesP.has(k)) {
              messagesP.set(k, []);
            }
            messagesP.get(k)!.push(newX);
          }
          res.status(200).send("ok");
        } else {
          res.status(200).send("ok");
        }
      } else if (messageType == "P") {
        if (!messagesP.has(k)) {
          messagesP.set(k, []);
        }
        messagesP.get(k)!.push(x);
        res.status(200).send("ok");
      }
    } else {
      res.status(500).send("faulty");
    }
  });


  // TODO implement this
  // this route is used to start the consensus algorithm
  // node.get("/start", async (req, res) => {});
  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) {await delay(5);}

    if (!isFaulty) {  
      nodeState.decided = false;
      nodeState.x = initialValue;
      nodeState.k = 1;
      messagesR = new Map();
      messagesP = new Map();
      for (let i = 0; i < N; i++) {
        if (i != nodeId) {
          await fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              k: 0,
              x: initialValue,
              messageType: "R",
            }),
          });
        }
      }
      res.status(200).send("ok");
    } else {
      res.status(500).send("faulty");
    }
  });

  // TODO implement this
  // this route is used to stop the consensus algorithm
  // node.get("/stop", async (req, res) => {});
  node.get("/stop", async (req, res) => {
    if (!isFaulty) {
      nodeState.killed = true;
      res.status(200).send("ok");
    } else {
      res.status(500).send("faulty");
    }
  });

  // TODO implement this
  // get the current state of a node
  // node.get("/getState", (req, res) => {});
  node.get("/getState", (req, res) => {
    res.status(200).send({ x: nodeState.x, k: nodeState.k, killed: nodeState.killed, decided: nodeState.decided });
  });

  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}
