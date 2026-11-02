import amqp from "amqplib";

export async function connectQueue(url: string, queue = "deployments") {
  const connection = await amqp.connect(url);
  const channel = await connection.createConfirmChannel();
  await channel.assertQueue(`${queue}.dead`, {
    durable: true,
    arguments: { "x-queue-type": "quorum" },
  });
  await channel.assertQueue(queue, {
    durable: true,
    arguments: {
      "x-queue-type": "quorum",
      "x-delivery-limit": 5,
      "x-dead-letter-exchange": "",
      "x-dead-letter-routing-key": `${queue}.dead`,
    },
  });

  return {
    connection,

    async publish(message: object) {
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        contentType: "application/json",
      });
      await channel.waitForConfirms();
    },

    async consume(handle: (message: unknown) => Promise<void>) {
      await channel.prefetch(1);
      await channel.consume(queue, async (msg) => {
        if (!msg) return;
        try {
          await handle(JSON.parse(msg.content.toString()));
          channel.ack(msg);
        } catch (error) {
          console.error(error);
          channel.nack(msg, false, true);
        }
      });
    },

    close: () => connection.close(),
  };
}
