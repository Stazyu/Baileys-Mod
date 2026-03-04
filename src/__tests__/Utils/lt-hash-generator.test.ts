import { proto } from '../../../WAProto/index.js'
import { makeLtHashGenerator } from '../../Utils/chat-utils'

const SET = proto.SyncdMutation.SyncdOperation.SET
const REMOVE = proto.SyncdMutation.SyncdOperation.REMOVE

describe('makeLtHashGenerator', () => {
	const makeIndex = (id: string) => Buffer.from(id)
	const makeValue = (id: string) => Buffer.from(`value-${id}`)

	it('handles SET operation normally', () => {
		const state = {
			hash: Buffer.alloc(128),
			indexValueMap: {}
		}

		const gen = makeLtHashGenerator(state)
		gen.mix({
			indexMac: makeIndex('idx1'),
			valueMac: makeValue('v1'),
			operation: SET
		})

		const result = gen.finish()
		const key = makeIndex('idx1').toString('base64')
		expect(result.indexValueMap[key]).toBeDefined()
		expect(Buffer.from(result.indexValueMap[key]!.valueMac)).toEqual(makeValue('v1'))
	})

	it('handles REMOVE with existing previous op', () => {
		const indexKey = makeIndex('idx1').toString('base64')
		const state = {
			hash: Buffer.alloc(128),
			indexValueMap: {
				[indexKey]: { valueMac: makeValue('old-v1') }
			}
		}

		const gen = makeLtHashGenerator(state)
		gen.mix({
			indexMac: makeIndex('idx1'),
			valueMac: makeValue('v1'),
			operation: REMOVE
		})

		const result = gen.finish()
		expect(result.indexValueMap[indexKey]).toBeUndefined()
	})

	it('does not throw on REMOVE without previous op', () => {
		const state = {
			hash: Buffer.alloc(128),
			indexValueMap: {}
		}

		const gen = makeLtHashGenerator(state)
		expect(() => {
			gen.mix({
				indexMac: makeIndex('idx1'),
				valueMac: makeValue('v1'),
				operation: REMOVE
			})
		}).not.toThrow()
	})

	it('continues processing after REMOVE without previous op', () => {
		const state = {
			hash: Buffer.alloc(128),
			indexValueMap: {}
		}

		const gen = makeLtHashGenerator(state)

		gen.mix({
			indexMac: makeIndex('idx1'),
			valueMac: makeValue('v1'),
			operation: REMOVE
		})

		gen.mix({
			indexMac: makeIndex('idx2'),
			valueMac: makeValue('v2'),
			operation: SET
		})

		const result = gen.finish()
		const key2 = makeIndex('idx2').toString('base64')
		expect(result.indexValueMap[key2]).toBeDefined()
		expect(Buffer.from(result.indexValueMap[key2]!.valueMac)).toEqual(makeValue('v2'))
	})

	it('does not add missing REMOVE to indexValueMap', () => {
		const state = {
			hash: Buffer.alloc(128),
			indexValueMap: {}
		}

		const gen = makeLtHashGenerator(state)
		gen.mix({
			indexMac: makeIndex('idx1'),
			valueMac: makeValue('v1'),
			operation: REMOVE
		})

		const result = gen.finish()
		const key = makeIndex('idx1').toString('base64')
		expect(result.indexValueMap[key]).toBeUndefined()
	})

	it('processes mix of SET and REMOVE cases', () => {
		const existingKey = makeIndex('existing').toString('base64')
		const state = {
			hash: Buffer.alloc(128),
			indexValueMap: {
				[existingKey]: { valueMac: makeValue('old') }
			}
		}

		const gen = makeLtHashGenerator(state)

		gen.mix({
			indexMac: makeIndex('new-entry'),
			valueMac: makeValue('new'),
			operation: SET
		})

		gen.mix({
			indexMac: makeIndex('existing'),
			valueMac: makeValue('existing'),
			operation: REMOVE
		})

		gen.mix({
			indexMac: makeIndex('ghost'),
			valueMac: makeValue('ghost'),
			operation: REMOVE
		})

		const result = gen.finish()
		const newKey = makeIndex('new-entry').toString('base64')
		const ghostKey = makeIndex('ghost').toString('base64')

		expect(result.indexValueMap[newKey]).toBeDefined()
		expect(result.indexValueMap[existingKey]).toBeUndefined()
		expect(result.indexValueMap[ghostKey]).toBeUndefined()
	})
})
