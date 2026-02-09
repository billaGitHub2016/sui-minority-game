
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env before importing the route
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Import the GET function from the route
// Using relative path to the route file
import { GET } from '../src/app/api/cron/reveal-votes/route'

async function main() {
    console.log("🚀 Manually triggering Reveal Votes Job...")
    
    try {
        // Execute the GET function
        const response = await GET()
        
        // Parse JSON result
        const data = await response.json()
        
        if (response.status === 200) {
            console.log("✅ Job executed successfully")
        } else {
            console.error(`❌ Job failed with status ${response.status}`)
        }
        
        console.log("📄 Result:", JSON.stringify(data, null, 2))
        
    } catch (error) {
        console.error("❌ Error executing job:", error)
    }
}

main().catch(console.error)
