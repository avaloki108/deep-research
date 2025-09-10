import * as fs from 'fs/promises';
import * as readline from 'readline';

import { getModel } from './ai/providers';
import {
  deepResearch,
  writeFinalAnswer,
  writeFinalReport,
} from './deep-research';
import { generateFeedback } from './feedback';
import { runVulnerabilityResearch } from './vulnerability/vulnerability-research';

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

// run the agent
async function run() {
  console.log('Using model: ', getModel().modelId);

  // Get research mode
  const researchMode = await askQuestion(
    'Select research mode:\n1. General research (default)\n2. Vulnerability research\nEnter choice (1/2): '
  );

  if (researchMode === '2') {
    console.log('\n🔍 Starting vulnerability research mode...\n');
    
    const vulnQuery = await askQuestion('What vulnerability/security topic would you like to research? ');
    
    const maxTargets = parseInt(
      await askQuestion('Maximum targets to analyze (default 20): ') || '20'
    );
    
    const focusOnBounties = (await askQuestion('Focus on bug bounty programs? (y/n, default y): ') || 'y').toLowerCase() === 'y';
    
    const includeAnalysis = (await askQuestion('Include static code analysis? (y/n, default y): ') || 'y').toLowerCase() === 'y';
    
    const minStars = parseInt(
      await askQuestion('Minimum GitHub stars (default 50): ') || '50'
    );

    try {
      const report = await runVulnerabilityResearch(vulnQuery, {
        maxTargets,
        focusOnBounties,
        includeContractAnalysis: includeAnalysis,
        minStars
      });

      console.log('\n✅ Vulnerability research completed!');
      console.log('📄 Report saved to vulnerability-report.md');
      console.log('\n📋 Report preview:');
      console.log('='.repeat(50));
      console.log(report.substring(0, 1000) + '...\n');
      
    } catch (error) {
      console.error('❌ Error during vulnerability research:', error);
    }
    
    rl.close();
    return;
  }

  // Original general research mode
  // Get initial query
  const initialQuery = await askQuestion('What would you like to research? ');

  // Get breath and depth parameters
  const breadth =
    parseInt(
      await askQuestion(
        'Enter research breadth (recommended 2-10, default 4): ',
      ),
      10,
    ) || 4;
  const depth =
    parseInt(
      await askQuestion('Enter research depth (recommended 1-5, default 2): '),
      10,
    ) || 2;
  const isReport =
    (await askQuestion(
      'Do you want to generate a long report or a specific answer? (report/answer, default report): ',
    )) !== 'answer';

  let combinedQuery = initialQuery;
  if (isReport) {
    log(`Creating research plan...`);

    // Generate follow-up questions
    const followUpQuestions = await generateFeedback({
      query: initialQuery,
    });

    log(
      '\nTo better understand your research needs, please answer these follow-up questions:',
    );

    // Collect answers to follow-up questions
    const answers: string[] = [];
    for (const question of followUpQuestions) {
      const answer = await askQuestion(`\n${question}\nYour answer: `);
      answers.push(answer);
    }

    // Combine all information for deep research
    combinedQuery = `
Initial Query: ${initialQuery}
Follow-up Questions and Answers:
${followUpQuestions.map((q: string, i: number) => `Q: ${q}\nA: ${answers[i]}`).join('\n')}
`;
  }

  log('\nStarting research...\n');

  const { learnings, visitedUrls } = await deepResearch({
    query: combinedQuery,
    breadth,
    depth,
  });

  log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
  log(`\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`);
  log('Writing final report...');

  if (isReport) {
    const report = await writeFinalReport({
      prompt: combinedQuery,
      learnings,
      visitedUrls,
    });

    await fs.writeFile('report.md', report, 'utf-8');
    console.log(`\n\nFinal Report:\n\n${report}`);
    console.log('\nReport has been saved to report.md');
  } else {
    const answer = await writeFinalAnswer({
      prompt: combinedQuery,
      learnings,
    });

    await fs.writeFile('answer.md', answer, 'utf-8');
    console.log(`\n\nFinal Answer:\n\n${answer}`);
    console.log('\nAnswer has been saved to answer.md');
  }

  rl.close();
}

run().catch(console.error);
