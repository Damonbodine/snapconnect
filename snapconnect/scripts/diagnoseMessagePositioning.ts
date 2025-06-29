/**
 * Comprehensive Message Positioning Diagnostic Script
 * 
 * This script helps identify why messages appear on the wrong side of the chat.
 * Run this in your React Native app to get detailed analysis.
 */

// Import required services and types
import { supabase } from '../src/services/supabase';
import { MessageWithUser } from '../src/services/messageService';

interface DiagnosticReport {
  summary: {
    totalMessages: number;
    aiMessages: number;
    humanMessages: number;
    positioningIssues: number;
  };
  issues: Array<{
    messageId: string;
    issue: string;
    severity: 'critical' | 'warning' | 'info';
    recommendation: string;
  }>;
  rawData: any[];
}

export class MessagePositioningDiagnostic {
  
  /**
   * Run comprehensive diagnostic on message positioning
   */
  static async runFullDiagnostic(userId: string, friendId: string): Promise<DiagnosticReport> {
    console.log('🔍 Starting Message Positioning Diagnostic...');
    console.log(`User ID: ${userId}, Friend ID: ${friendId}`);
    
    const report: DiagnosticReport = {
      summary: { totalMessages: 0, aiMessages: 0, humanMessages: 0, positioningIssues: 0 },
      issues: [],
      rawData: []
    };

    try {
      // 1. Test database function directly
      console.log('\n📊 Testing database function...');
      const { data: messages, error } = await supabase.rpc('get_messages_with_ai_support', {
        other_user_id: friendId,
        limit_count: 20
      });

      if (error) {
        report.issues.push({
          messageId: 'db_function',
          issue: `Database function error: ${error.message}`,
          severity: 'critical',
          recommendation: 'Fix the database function before proceeding'
        });
        return report;
      }

      report.rawData = messages || [];
      report.summary.totalMessages = messages?.length || 0;

      // 2. Analyze each message
      console.log('\n🔍 Analyzing message data...');
      messages?.forEach((msg: any, index: number) => {
        this.analyzeMessage(msg, userId, friendId, report, index);
      });

      // 3. Test positioning logic
      console.log('\n🎯 Testing positioning logic...');
      this.testPositioningLogic(messages || [], userId, report);

      // 4. Generate summary
      this.generateSummary(report);

      return report;

    } catch (error: any) {
      console.error('❌ Diagnostic failed:', error);
      report.issues.push({
        messageId: 'diagnostic',
        issue: `Diagnostic script error: ${error.message}`,
        severity: 'critical',
        recommendation: 'Check network connection and authentication'
      });
      return report;
    }
  }

  /**
   * Analyze individual message for issues
   */
  private static analyzeMessage(
    msg: any, 
    userId: string, 
    friendId: string, 
    report: DiagnosticReport, 
    index: number
  ) {
    const msgPrefix = `Message ${index + 1}`;
    
    // Count message types
    if (msg.is_ai_sender) {
      report.summary.aiMessages++;
    } else {
      report.summary.humanMessages++;
    }

    // Check AI message structure
    if (msg.is_ai_sender) {
      if (msg.sender_id !== null) {
        report.issues.push({
          messageId: msg.id,
          issue: `${msgPrefix}: AI message has non-null sender_id (${msg.sender_id})`,
          severity: 'critical',
          recommendation: 'AI messages should have sender_id = null'
        });
        report.summary.positioningIssues++;
      }
      
      if (msg.receiver_id !== userId) {
        report.issues.push({
          messageId: msg.id,
          issue: `${msgPrefix}: AI message receiver_id (${msg.receiver_id}) doesn't match current user (${userId})`,
          severity: 'warning',
          recommendation: 'AI messages should be sent to the current user'
        });
      }
    }

    // Check human message structure
    if (!msg.is_ai_sender) {
      if (msg.sender_id === null) {
        report.issues.push({
          messageId: msg.id,
          issue: `${msgPrefix}: Human message has null sender_id`,
          severity: 'critical',
          recommendation: 'Human messages must have a valid sender_id'
        });
        report.summary.positioningIssues++;
      }
      
      // Validate sender/receiver relationship
      const validPattern = (
        (msg.sender_id === userId && msg.receiver_id === friendId) ||
        (msg.sender_id === friendId && msg.receiver_id === userId)
      );
      
      if (!validPattern) {
        report.issues.push({
          messageId: msg.id,
          issue: `${msgPrefix}: Invalid sender/receiver pattern. Sender: ${msg.sender_id}, Receiver: ${msg.receiver_id}`,
          severity: 'warning',
          recommendation: 'Check if message belongs to this conversation'
        });
      }
    }

    // Check for missing usernames (indicates JOIN issues)
    if (!msg.sender_username && msg.sender_id !== null) {
      report.issues.push({
        messageId: msg.id,
        issue: `${msgPrefix}: Missing sender_username despite having sender_id`,
        severity: 'warning',
        recommendation: 'Database JOIN may be failing'
      });
    }

    if (!msg.receiver_username) {
      report.issues.push({
        messageId: msg.id,
        issue: `${msgPrefix}: Missing receiver_username`,
        severity: 'warning',
        recommendation: 'Database JOIN may be failing'
      });
    }

    console.log(`  ${msgPrefix}:`, {
      content: msg.content?.substring(0, 20) + '...',
      sender_id: msg.sender_id,
      receiver_id: msg.receiver_id,
      is_ai_sender: msg.is_ai_sender,
      sender_username: msg.sender_username,
      receiver_username: msg.receiver_username
    });
  }

  /**
   * Test the positioning logic used in the chat component
   */
  private static testPositioningLogic(messages: any[], userId: string, report: DiagnosticReport) {
    messages.forEach((msg: any, index: number) => {
      const isOwn = msg.sender_id === userId;
      const expectedPosition = isOwn ? 'RIGHT' : 'LEFT';
      
      console.log(`  Message ${index + 1} positioning:`, {
        isOwn_calculation: `${msg.sender_id} === ${userId} = ${isOwn}`,
        position: expectedPosition,
        is_ai_sender: msg.is_ai_sender,
        content: msg.content?.substring(0, 20) + '...'
      });

      // AI messages should always be on the LEFT (not owned by user)
      if (msg.is_ai_sender && isOwn) {
        report.issues.push({
          messageId: msg.id,
          issue: `AI message incorrectly calculated as owned by user`,
          severity: 'critical',
          recommendation: 'AI messages should appear on LEFT side'
        });
        report.summary.positioningIssues++;
      }

      // User's own messages should be on the RIGHT
      if (!msg.is_ai_sender && msg.sender_id === userId && !isOwn) {
        report.issues.push({
          messageId: msg.id,
          issue: `User's own message incorrectly calculated as not owned`,
          severity: 'critical',
          recommendation: 'User messages should appear on RIGHT side'
        });
        report.summary.positioningIssues++;
      }
    });
  }

  /**
   * Generate diagnostic summary
   */
  private static generateSummary(report: DiagnosticReport) {
    console.log('\n📋 DIAGNOSTIC SUMMARY');
    console.log('===================');
    console.log(`Total Messages: ${report.summary.totalMessages}`);
    console.log(`AI Messages: ${report.summary.aiMessages}`);
    console.log(`Human Messages: ${report.summary.humanMessages}`);
    console.log(`Positioning Issues: ${report.summary.positioningIssues}`);
    console.log(`Total Issues Found: ${report.issues.length}`);

    if (report.issues.length === 0) {
      console.log('✅ No issues found! Message positioning should work correctly.');
    } else {
      console.log('\n🚨 Issues Found:');
      const critical = report.issues.filter(i => i.severity === 'critical');
      const warnings = report.issues.filter(i => i.severity === 'warning');
      
      console.log(`  Critical: ${critical.length}`);
      console.log(`  Warnings: ${warnings.length}`);
      
      if (critical.length > 0) {
        console.log('\n❌ CRITICAL ISSUES (fix these first):');
        critical.forEach(issue => {
          console.log(`  - ${issue.issue}`);
          console.log(`    Recommendation: ${issue.recommendation}`);
        });
      }
      
      if (warnings.length > 0) {
        console.log('\n⚠️ WARNINGS:');
        warnings.forEach(issue => {
          console.log(`  - ${issue.issue}`);
          console.log(`    Recommendation: ${issue.recommendation}`);
        });
      }
    }
  }

  /**
   * Quick test you can run in your app console
   */
  static async quickTest(currentUserId: string, friendId: string) {
    console.log('🚀 Running Quick Message Positioning Test...');
    
    const report = await this.runFullDiagnostic(currentUserId, friendId);
    
    // Return simplified results for easy debugging
    return {
      success: report.issues.filter(i => i.severity === 'critical').length === 0,
      totalMessages: report.summary.totalMessages,
      criticalIssues: report.issues.filter(i => i.severity === 'critical').length,
      recommendations: report.issues.map(i => i.recommendation)
    };
  }
}

// Export for use in app
export default MessagePositioningDiagnostic;