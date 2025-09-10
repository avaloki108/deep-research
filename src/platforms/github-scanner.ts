import { Octokit } from '@octokit/rest';
import { RateLimiter, withRetry } from '../utils/helpers';

export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  url: string;
  topics: string[];
  hasIssues: boolean;
  bountyIndicators: string[];
}

export interface SmartContractFile {
  repo: GitHubRepo;
  path: string;
  content: string;
  size: number;
  language: string;
}

export class GitHubScanner {
  private octokit: Octokit;
  private rateLimiter: RateLimiter;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN,
    });
    this.rateLimiter = new RateLimiter(30, 60000); // 30 requests per minute
  }

  async findSmartContractRepos(query: string = 'smart contract', options: {
    language?: string;
    minStars?: number;
    maxResults?: number;
    hasBounty?: boolean;
  } = {}): Promise<GitHubRepo[]> {
    const {
      language = 'solidity',
      minStars = 10,
      maxResults = 50,
      hasBounty = false
    } = options;

    let searchQuery = `${query} language:${language}`;
    
    if (minStars > 0) {
      searchQuery += ` stars:>=${minStars}`;
    }

    if (hasBounty) {
      searchQuery += ` "bug bounty" OR "bounty program" OR "security bounty"`;
    }

    try {
      await this.rateLimiter.waitIfNeeded();
      
      const response = await withRetry(() => 
        this.octokit.rest.search.repos({
          q: searchQuery,
          sort: 'stars',
          order: 'desc',
          per_page: Math.min(maxResults, 100)
        })
      );

      const repos: GitHubRepo[] = [];

      for (const repo of response.data.items.slice(0, maxResults)) {
        const bountyIndicators = this.detectBountyIndicators(
          repo.description || '',
          repo.topics || []
        );

        repos.push({
          owner: repo.owner?.login || '',
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || '',
          language: repo.language || '',
          stars: repo.stargazers_count,
          url: repo.html_url,
          topics: repo.topics || [],
          hasIssues: repo.has_issues,
          bountyIndicators
        });
      }

      return repos;
    } catch (error) {
      console.error('Error searching GitHub repositories:', error);
      return [];
    }
  }

  async getSmartContractFiles(repo: GitHubRepo, maxFiles: number = 20): Promise<SmartContractFile[]> {
    try {
      // Search for smart contract files
      const extensions = ['.sol', '.vy', '.cairo', '.move'];
      const files: SmartContractFile[] = [];

      for (const ext of extensions) {
        if (files.length >= maxFiles) break;

        try {
          const searchResult = await this.octokit.rest.search.code({
            q: `extension:${ext.slice(1)} repo:${repo.fullName}`,
            per_page: Math.min(maxFiles - files.length, 30)
          });

          for (const item of searchResult.data.items) {
            if (files.length >= maxFiles) break;

            try {
              const content = await this.getFileContent(repo.owner, repo.name, item.path);
              if (content) {
                files.push({
                  repo,
                  path: item.path,
                  content,
                  size: content.length,
                  language: this.getLanguageFromExtension(ext)
                });
              }
            } catch (error) {
              console.log(`Could not fetch file ${item.path}:`, error);
            }
          }
        } catch (error) {
          console.log(`Error searching for ${ext} files in ${repo.fullName}:`, error);
        }
      }

      return files;
    } catch (error) {
      console.error(`Error getting smart contract files for ${repo.fullName}:`, error);
      return [];
    }
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path
      });

      if ('content' in response.data && response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      console.error(`Error getting file content for ${path}:`, error);
      return null;
    }
  }

  async checkForBugBountyProgram(repo: GitHubRepo): Promise<{
    hasBounty: boolean;
    indicators: string[];
    sources: string[];
  }> {
    const indicators: string[] = [];
    const sources: string[] = [];

    // Check repository description and topics
    const repoIndicators = this.detectBountyIndicators(repo.description, repo.topics);
    if (repoIndicators.length > 0) {
      indicators.push(...repoIndicators);
      sources.push('repository metadata');
    }

    try {
      // Check for bounty-related files
      const bountyFiles = [
        'SECURITY.md',
        'BOUNTY.md',
        'BUG_BOUNTY.md',
        'security.md',
        'bounty.md',
        'bug_bounty.md',
        '.github/SECURITY.md'
      ];

      for (const file of bountyFiles) {
        try {
          const content = await this.getFileContent(repo.owner, repo.name, file);
          if (content) {
            const fileIndicators = this.detectBountyIndicators(content, []);
            if (fileIndicators.length > 0) {
              indicators.push(...fileIndicators);
              sources.push(file);
            }
          }
        } catch (error) {
          // File doesn't exist, continue
        }
      }

      // Check README for bounty information
      try {
        const readmeContent = await this.getFileContent(repo.owner, repo.name, 'README.md');
        if (readmeContent) {
          const readmeIndicators = this.detectBountyIndicators(readmeContent, []);
          if (readmeIndicators.length > 0) {
            indicators.push(...readmeIndicators);
            sources.push('README.md');
          }
        }
      } catch (error) {
        // README doesn't exist or couldn't be fetched
      }

    } catch (error) {
      console.error(`Error checking bounty program for ${repo.fullName}:`, error);
    }

    return {
      hasBounty: indicators.length > 0,
      indicators: [...new Set(indicators)],
      sources: [...new Set(sources)]
    };
  }

  private detectBountyIndicators(text: string, topics: string[]): string[] {
    const indicators: string[] = [];
    const lowerText = text.toLowerCase();
    const allTopics = topics.map(t => t.toLowerCase());

    const patterns = [
      'bug bounty',
      'bounty program',
      'security bounty',
      'vulnerability disclosure',
      'responsible disclosure',
      'security reward',
      'hackerone',
      'bugcrowd',
      'immunefi',
      'code4rena',
      'sherlock',
      'cantina',
      'spearbit'
    ];

    for (const pattern of patterns) {
      if (lowerText.includes(pattern) || allTopics.some(topic => topic.includes(pattern))) {
        indicators.push(pattern);
      }
    }

    // Check for bounty-related URLs
    const urlPatterns = [
      /hackerone\.com\/[\w-]+/g,
      /bugcrowd\.com\/[\w-]+/g,
      /immunefi\.com\/[\w-]+/g,
      /code4rena\.com\/[\w-]+/g,
    ];

    for (const pattern of urlPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        indicators.push(...matches);
      }
    }

    return indicators;
  }

  private getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
      '.sol': 'solidity',
      '.vy': 'vyper',
      '.cairo': 'cairo',
      '.move': 'move'
    };

    return languageMap[ext] || 'unknown';
  }

  async getRepoIssues(repo: GitHubRepo, searchTerms: string[] = ['bug', 'vulnerability', 'security']): Promise<any[]> {
    try {
      const issues = [];
      
      for (const term of searchTerms) {
        const response = await this.octokit.rest.search.issuesAndPullRequests({
          q: `${term} repo:${repo.fullName} is:issue`,
          per_page: 20
        });
        
        issues.push(...response.data.items);
      }

      return issues;
    } catch (error) {
      console.error(`Error getting issues for ${repo.fullName}:`, error);
      return [];
    }
  }
}