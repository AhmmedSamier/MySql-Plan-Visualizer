import type { Plan } from "./types"

const DB_NAME = "pev2"
const DB_VERSION = 1
let DB: IDBDatabase | null = null

function deepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default {
  async getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (DB) {
        return resolve(DB)
      }
      console.log("OPENING DB", DB)
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = (e) => {
        console.log("Error opening db", e)
        reject("Error")
      }

      request.onsuccess = () => {
        DB = request.result
        resolve(DB)
      }

      request.onupgradeneeded = () => {
        console.log("onupgradeneeded")
        const db = request.result
        db.createObjectStore("plans", { autoIncrement: true, keyPath: "id" })
      }
    })
  },

  async deletePlan(plan: Plan & { id?: number }): Promise<void> {
    const db = await this.getDb()

    return new Promise<void>((resolve) => {
      const trans = db.transaction(["plans"], "readwrite")
      trans.oncomplete = () => {
        resolve()
      }

      const store = trans.objectStore("plans")
      if (plan.id) {
        store.delete(plan.id)
      }
    })
  },

  async getPlans(): Promise<Plan[]> {
    const db = await this.getDb()

    return new Promise((resolve) => {
      const trans = db.transaction(["plans"], "readonly")
      trans.oncomplete = () => {
        resolve(plans)
      }

      const store = trans.objectStore("plans")
      const plans: Plan[] = []

      store.openCursor().onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result
        if (cursor) {
          plans.push(cursor.value)
          cursor.continue()
        }
      }
    })
  },

  async savePlan(plan: Plan): Promise<void> {
    const db = await this.getDb()

    return new Promise<void>((resolve) => {
      const trans = db.transaction(["plans"], "readwrite")
      trans.oncomplete = () => {
        resolve()
      }

      const store = trans.objectStore("plans")
      store.put(plan)
    })
  },

  async importPlans(plans: Plan[]): Promise<number[]> {
    const db = await this.getDb()

    return new Promise<number[]>((resolve, reject) => {
      const trans = db.transaction(["plans"], "readwrite")
      const store = trans.objectStore("plans")

      let count = 0
      let duplicates = 0
      let processed = 0

      trans.oncomplete = () => {
        resolve([count, duplicates])
      }

      trans.onerror = () => {
        reject(trans.error)
      }

      if (plans.length === 0) {
        resolve([0, 0])
        return
      }

      // We need to process sequentially or handle async inside loop
      // But openCursor is async.
      // Simpler approach: Load all existing plans and compare in memory
      // This matches the previous logic more or less but cleaner.

      const getAllReq = store.getAll()
      getAllReq.onsuccess = () => {
        const existingPlans = getAllReq.result as any[]

        for (const plan of plans) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const planAny = plan as any
          if (planAny.id) delete planAny.id

          const isDuplicate = existingPlans.some((existing) => {
            return deepEqual(existing, plan)
          })

          if (!isDuplicate) {
            store.add(plan)
            count++
          } else {
            duplicates++
          }
        }
      }
    })
  },
}
