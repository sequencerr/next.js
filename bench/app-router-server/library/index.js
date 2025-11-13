export function Server() {
  return 'This is Server'
}

import { Foo } from './client.js'
export function Client() {
  return <Foo />
}

import { Bar } from './action.js'
export function Action() {
  return <Bar />
}
