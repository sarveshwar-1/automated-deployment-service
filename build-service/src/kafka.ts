import { Kafka } from 'kafkajs'
import { KAFKA_BROKER } from './config/env'

const client = new Kafka({
  clientId: 'kafka-client',
  brokers: [KAFKA_BROKER],
})

export { client }