import { Kafka } from 'kafkajs'

const client = new Kafka({
  clientId: 'kafka-client',
  brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
})

export { client }