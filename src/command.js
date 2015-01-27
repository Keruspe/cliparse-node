var _ = require("lodash");

var argument = require("./argument");
var autocomplete = require("./autocomplete");
var option = require("./option");
var parsers = require("./parsers");
var utils = require("./utils");


var command = module.exports = {};

command.command = function(name, options, cb) {
  options = options || {};
  options.name = name;
  options.description = options.description || "";
  options.args = options.args || [];
  options.options = options.options || [];
  options.commands = options.commands || [];
  options.action = typeof cb !== 'undefined' ? cb : null;
  return options;
};

command.autocomplete = function(cmd, parentOptions, argv, words, index) {
  var currentWord = words[index];
  var previousWord = words[index - 1];
  var availOptionNames = autocomplete.empty;
  var availOptionValues = autocomplete.empty;
  var availArgs = autocomplete.empty;
  var availCommands = autocomplete.empty;

  var allOptions = parentOptions.concat(cmd.options);

  if(typeof currentWord === 'string' && currentWord.slice(0, 1) === '-') {
    // Complete option name
    availOptionNames = autocomplete.mconcat(_.map(allOptions, option.completeName));
  } else if(typeof previousWord === 'string' && previousWord.slice(0, 1) === '-') {
    // Complete option value
    var name = previousWord.slice(0, 2) === '--' ? previousWord.slice(2) : previousWord.slice(1);
    var previousOption = _.find(allOptions, function(opt) {
      return _.contains(opt.names, name);
    });

    if(previousOption && previousOption.metavar) {
      availOptionValues = option.complete(previousOption, currentWord);
    }
  }

  // Complete commands
  var commandNames = _.pluck(cmd.commands, 'name');
  availCommands = autocomplete.words(commandNames);
  // Complete arguments
  var argsComplete = _.map(cmd.args, function(arg) {
    return argument.complete(arg, currentWord);
  });
  availArgs = autocomplete.mconcat(argsComplete);

  // ToDo manage nested completion

  return autocomplete.mconcat([availOptionNames, availOptionValues, availArgs, availCommands]);
};

command.parseFinal = function(cmd, parentOptions, givenArgs, givenOpts) {
  var result;
  var parsedArguments = argument.parseList(cmd.args, givenArgs);
  var parsedOptions = option.parseObject(cmd.options.concat(parentOptions), givenOpts);

  if(parsers.isSuccess(parsedArguments) && parsers.isSuccess(parsedOptions)) {
    result = parsers.success({
      args: parsedArguments.success,
      options: parsedOptions.success
    });
  } else {
    result = parsers.error({
      args: parsedArguments.error || [],
      options: parsedOptions.error || {}
    });
  }
  result.context = [cmd];

  return result;
};

command.parse = function(cmd, parentOptions, givenArgs, givenOpts) {
  var result;
  var matchedCommand = _.find(cmd.commands, function(subcommand) {
    return subcommand.name === _.head(givenArgs);
  });

  if(matchedCommand) {
    result = command.parse(matchedCommand, cmd.options.concat(parentOptions), _.drop(givenArgs, 1), givenOpts);
    result.context = [cmd].concat(result.context);
  } else {
    result = command.parseFinal(cmd, parentOptions, givenArgs, givenOpts);
  }

  return result;
};

command.singleLineHelp = function(cmd) {
  return [cmd.name + " " + _.map(cmd.arg, argument.help), cmd.description];
};

command.usage = function(context) {
  var cmd = _.last(context);
  var elems = _(context).map(function(cmd) {
    var required = _.filter(cmd.options, function(opt) { return opt.required; });
    return [ cmd.name ].concat(_.map(required, option.usage));
  }).flatten();
  var args = _.map(cmd.args, argument.usage);

  return elems.concat(args).join(' ');
};

command.help = function(context) {
  var options = _.flatten(_.map(context, function(cmd) { return cmd.options; }));

  var usage = "Usage: " + command.usage(context);

  var cmd = _.last(context);
  var argumentHelp = _.map(cmd.args, argument.help);
  var commandsList = _.map(cmd.commands, command.singleLineHelp);
  var optionsList = _.map(options, option.help);

  var leftColumnWidth = 5 + _.max(_.map(argumentHelp.concat(commandsList, optionsList), function(cells) {
    return cells[0].length;
  }));

  var output = usage + '\n';
  if(cmd.description) output += cmd.description + '\n';
  output += '\n';

  if(!_.isEmpty(argumentHelp)) {
    output += 'Arguments:\n';
    _.each(argumentHelp, function(arg) {
      var padding = new Array(leftColumnWidth - arg[0].length + 1).join(' ');
      output += arg[0] + padding + arg[1] +'\n';
    });
    output += '\n';
  }

  if(!_.isEmpty(optionsList)) {
    output += 'Options:\n';
    _.each(optionsList, function(arg) {
      var padding = new Array(leftColumnWidth - arg[0].length + 1).join(' ');
      output += arg[0] + padding + arg[1] +'\n';
    });
    output += '\n';
  }

  if(!_.isEmpty(commandsList)) {
    output += 'Available Commands:\n';
    _.each(commandsList, function(arg) {
      var padding = new Array(leftColumnWidth - arg[0].length + 1).join(' ');
      output += arg[0] + padding + arg[1] +'\n';
    });
    output += '\n';
  }
  return output;
};

command.helpCommand = command.command('help', { description: 'display help about this program' });
