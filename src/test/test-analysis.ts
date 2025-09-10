import { StaticAnalysisEngine } from '../vulnerability/static-analysis';

// Simple test for the static analysis engine
async function testStaticAnalysis() {
  console.log('🧪 Testing Static Analysis Engine...');
  
  const engine = new StaticAnalysisEngine();
  
  // Sample vulnerable Solidity contract
  const vulnerableContract = `
    pragma solidity ^0.8.0;
    
    contract VulnerableContract {
        mapping(address => uint) public balances;
        
        function withdraw(uint amount) public {
            require(balances[msg.sender] >= amount);
            (bool success,) = msg.sender.call{value: amount}("");
            require(success);
            balances[msg.sender] -= amount; // State change after external call - reentrancy!
        }
        
        function unsafeFunction() public {
            // No access control
            selfdestruct(payable(tx.origin)); // tx.origin usage
        }
        
        function randomNumber() public view returns (uint) {
            return uint(keccak256(abi.encodePacked(block.timestamp, block.difficulty)));
        }
    }
  `;
  
  try {
    const result = await engine.analyzeSourceCode(vulnerableContract, 'test-contract');
    
    console.log('✅ Analysis completed!');
    console.log(`📊 Risk Score: ${result.riskScore}/100`);
    console.log(`🔍 Vulnerabilities Found: ${result.vulnerabilities.length}`);
    
    for (const vuln of result.vulnerabilities) {
      console.log(`\n⚠️  ${vuln.pattern.name} (${vuln.pattern.severity})`);
      console.log(`   ${vuln.pattern.description}`);
      console.log(`   Confidence: ${Math.round(vuln.confidence * 100)}%`);
    }
    
    console.log('\n📋 Summary:');
    console.log(result.summary);
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

if (require.main === module) {
  testStaticAnalysis().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testStaticAnalysis };