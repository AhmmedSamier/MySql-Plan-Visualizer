import type { Plan } from "./types"

const DB_NAME = "mpv"
const DB_VERSION = 2
let DB: IDBDatabase | null = null

const indexedDBFactory: IDBFactory | undefined =
  typeof window !== "undefined"
    ? window.indexedDB
    : (globalThis as { indexedDB?: IDBFactory }).indexedDB
export default {
  async getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (DB) {
        return resolve(DB)
      }
      if (!indexedDBFactory) {
        return reject("IndexedDB not available in this environment")
      }
      console.log("OPENING DB", DB)
      const request = indexedDBFactory.open(DB_NAME, DB_VERSION)

      request.onerror = (e) => {
        console.log("Error opening db", e)
        reject("Error")
      }

      request.onsuccess = () => {
        DB = request.result
        resolve(DB)
      }

      request.onupgradeneeded = (event) => {
        console.log("onupgradeneeded")
        const db = request.result
        if (event.oldVersion < 1) {
          db.createObjectStore("plans", { autoIncrement: true, keyPath: "id" })
        }
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
          const plan = cursor.value
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(plan as any).id = cursor.key
          plans.push(plan)
          cursor.continue()
        }
      }
    })
  },

  async getPlan(id: number): Promise<Plan | undefined> {
    const db = await this.getDb()

    return new Promise((resolve) => {
      const trans = db.transaction(["plans"], "readonly")
      const store = trans.objectStore("plans")
      const request = store.get(id)

      request.onsuccess = () => {
        const plan = request.result
        if (plan) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(plan as any).id = id
        }
        resolve(plan)
      }
    })
  },

  async savePlan(plan: Plan): Promise<number> {
    const db = await this.getDb()

    return new Promise<number>((resolve, reject) => {
      const trans = db.transaction(["plans"], "readwrite")
      const store = trans.objectStore("plans")
      const request = store.put(plan)

      request.onsuccess = () => {
        resolve(request.result as number)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  },

  async importPlans(plans: (Plan & { id?: number })[]): Promise<number[]> {
    const db = await this.getDb()

    return new Promise<number[]>((resolve, reject) => {
      const trans = db.transaction(["plans"], "readwrite")
      const store = trans.objectStore("plans")

      let count = 0
      let duplicates = 0

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

      // Pre-process input plans to create a map of stringified plans
      const planMap = new Map<string, number[]>()
      const plansData = plans.map((plan, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const planAny = plan as any
        if (planAny.id) delete planAny.id

        const str = JSON.stringify(plan)

        if (!planMap.has(str)) {
          planMap.set(str, [])
        }
        planMap.get(str)!.push(index)

        return { plan, str, isDuplicate: false }
      })

      const cursorReq = store.openCursor()
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result
        if (cursor) {
          const existingPlan = cursor.value
          const existingStr = JSON.stringify(existingPlan)

          if (planMap.has(existingStr)) {
            const indices = planMap.get(existingStr)!
            for (const index of indices) {
              if (!plansData[index].isDuplicate) {
                plansData[index].isDuplicate = true
                duplicates++
              }
            }
            // Mark as found to avoid checking again
            planMap.delete(existingStr)
          }

          cursor.continue()
        } else {
          // Cursor finished. Insert non-duplicates.
          for (const item of plansData) {
            if (!item.isDuplicate) {
              store.add(item.plan)
              count++
            }
          }
        }
      }
    })
  },

  async clearPlans(): Promise<void> {
    const db = await this.getDb()

    return new Promise<void>((resolve) => {
      const trans = db.transaction(["plans"], "readwrite")
      trans.oncomplete = () => {
        resolve()
      }

      const store = trans.objectStore("plans")
      store.clear()
    })
  },
}
